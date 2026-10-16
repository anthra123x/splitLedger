import time
from typing import List, Dict, Any, Optional
import duckdb
import polars as pl

from ..models.schemas import (
    DecomposedInvoice,
    HighVolumeBatchAnalysisResult,
    AnomalyItem
)
from .anomaly_detector import FinancialAnomalyDetector


class HighVolumeDataDecomposer:
    """
    Motor analítico de descomposición y agregación para grandes volúmenes de datos financieros y contables.
    Aprovecha la velocidad columnar vectorizada de Polars y DuckDB.
    """

    def __init__(self):
        pass

    def process_batch(
        self,
        invoices: List[DecomposedInvoice],
        reasoning_insights: str = ""
    ) -> HighVolumeBatchAnalysisResult:
        start_time = time.perf_counter()

        if not invoices:
            return HighVolumeBatchAnalysisResult(
                total_documents=0,
                processed_count=0,
                total_volume_amount=0.0,
                total_tax_amount=0.0,
                total_retention_amount=0.0,
                balanced_percentage=100.0,
                processing_time_ms=0.0
            )

        # 1. Flatten into tabular records for Polars DataFrames
        header_records = []
        item_records = []

        for inv in invoices:
            header_records.append({
                "invoice_number": inv.invoice_number,
                "supplier_name": inv.supplier_name,
                "supplier_tax_id": inv.supplier_tax_id,
                "invoice_date": inv.invoice_date,
                "currency": inv.currency,
                "subtotal": inv.subtotal,
                "tax_total": inv.tax_total,
                "retention_total": inv.retention_total,
                "grand_total": inv.grand_total,
                "is_balanced": inv.is_balanced,
                "confidence_score": inv.confidence_score
            })

            for it in inv.items:
                item_records.append({
                    "invoice_number": inv.invoice_number,
                    "supplier_name": inv.supplier_name,
                    "concept": it.concept,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                    "base_amount": it.base_amount,
                    "tax_rate": it.tax_rate,
                    "tax_amount": it.tax_amount,
                    "total_amount": it.total_amount,
                    "account_code": it.account_code,
                    "account_name": it.account_name,
                    "cost_center": it.cost_center
                })

        df_headers = pl.DataFrame(header_records)
        df_items = pl.DataFrame(item_records) if item_records else pl.DataFrame()

        # Isolated in-memory connection per batch request (Concurrency & Thread-Safe)
        conn = duckdb.connect(database=":memory:")
        try:
            conn.register("invoices", df_headers.to_arrow())
            if not df_items.is_empty():
                conn.register("line_items", df_items.to_arrow())

            # 2. Vectorized Metric Calculations with DuckDB
            summary_query = """
                SELECT 
                    COUNT(*) as total_docs,
                    COALESCE(SUM(grand_total), 0.0) as total_volume,
                    COALESCE(SUM(tax_total), 0.0) as total_tax,
                    COALESCE(SUM(retention_total), 0.0) as total_retention,
                    (SUM(CASE WHEN is_balanced THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as balanced_pct
                FROM invoices
            """
            summary_row = conn.execute(summary_query).fetchone()
            total_docs, total_volume, total_tax, total_retention, balanced_pct = summary_row

            # Top Suppliers by Volume
            suppliers_query = """
                SELECT 
                    supplier_name,
                    supplier_tax_id,
                    COUNT(*) as invoice_count,
                    ROUND(SUM(grand_total), 2) as total_spent,
                    ROUND(AVG(grand_total), 2) as avg_invoice
                FROM invoices
                GROUP BY supplier_name, supplier_tax_id
                ORDER BY total_spent DESC
                LIMIT 10
            """
            top_suppliers = [
                dict(zip(["supplier_name", "supplier_tax_id", "invoice_count", "total_spent", "avg_invoice"], row))
                for row in conn.execute(suppliers_query).fetchall()
            ]

            # Tax Breakdown (from line items if available)
            tax_breakdown = []
            if not df_items.is_empty():
                tax_query = """
                    SELECT 
                        tax_rate,
                        ROUND(SUM(base_amount), 2) as base_sum,
                        ROUND(SUM(tax_amount), 2) as tax_sum,
                        ROUND(SUM(total_amount), 2) as total_sum,
                        COUNT(*) as items_count
                    FROM line_items
                    GROUP BY tax_rate
                    ORDER BY tax_rate DESC
                """
                tax_breakdown = [
                    dict(zip(["tax_rate", "base_sum", "tax_sum", "total_sum", "items_count"], row))
                    for row in conn.execute(tax_query).fetchall()
                ]

            # Cost Center Breakdown
            cost_centers = []
            if not df_items.is_empty():
                center_query = """
                    SELECT 
                        cost_center,
                        ROUND(SUM(total_amount), 2) as total_spent,
                        COUNT(*) as items_count
                    FROM line_items
                    GROUP BY cost_center
                    ORDER BY total_spent DESC
                """
                cost_centers = [
                    dict(zip(["cost_center", "total_spent", "items_count"], row))
                    for row in conn.execute(center_query).fetchall()
                ]

            # Monthly Trend
            monthly_trend = []
            try:
                trend_query = """
                    SELECT 
                        SUBSTRING(invoice_date, 1, 7) as month_period,
                        COUNT(*) as invoice_count,
                        ROUND(SUM(grand_total), 2) as monthly_volume
                    FROM invoices
                    WHERE invoice_date IS NOT NULL AND invoice_date != ''
                    GROUP BY month_period
                    ORDER BY month_period ASC
                """
                monthly_trend = [
                    dict(zip(["month_period", "invoice_count", "monthly_volume"], row))
                    for row in conn.execute(trend_query).fetchall()
                ]
            except Exception:
                pass
        finally:
            conn.close()

        # 3. Detect anomalies across document & batch level
        anomalies: List[AnomalyItem] = []
        for inv in invoices:
            anomalies.extend(FinancialAnomalyDetector.audit_single_document(inv))
        anomalies.extend(FinancialAnomalyDetector.audit_batch_dataset(invoices))

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        return HighVolumeBatchAnalysisResult(
            total_documents=int(total_docs),
            processed_count=len(invoices),
            total_volume_amount=round(float(total_volume), 2),
            total_tax_amount=round(float(total_tax), 2),
            total_retention_amount=round(float(total_retention), 2),
            balanced_percentage=round(float(balanced_pct or 100.0), 1),
            anomalies=anomalies,
            top_suppliers_by_volume=top_suppliers,
            tax_rate_breakdown=tax_breakdown,
            cost_center_breakdown=cost_centers,
            monthly_trend=monthly_trend,
            reasoning_insights=reasoning_insights,
            processing_time_ms=round(elapsed_ms, 2)
        )

    def execute_analytical_query(self, sql_query: str) -> List[Dict[str, Any]]:
        """
        Ejecuta una consulta SQL analítica segura en DuckDB.
        """
        conn = duckdb.connect(database=":memory:")
        try:
            res = conn.execute(sql_query)
            if not res.description:
                return []
            columns = [desc[0] for desc in res.description]
            return [dict(zip(columns, row)) for row in res.fetchall()]
        finally:
            conn.close()
