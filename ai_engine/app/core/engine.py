from typing import List, Dict, Any, Tuple
from .reasoner import SplitReasoner
from .data_decomposer import HighVolumeDataDecomposer
from .anomaly_detector import FinancialAnomalyDetector
from ..models.schemas import DecomposedInvoice, HighVolumeBatchAnalysisResult


class SplitReasonerEngine:
    """
    Motor Central de Razonamiento y Análisis Forense de Grandes Volúmenes de Información.
    """

    def __init__(self):
        self.decomposer = HighVolumeDataDecomposer()

    async def process_document(
        self,
        raw_text: str,
        filename: str = "documento",
        use_llm: bool = False
    ) -> DecomposedInvoice:
        """
        Descompone un documento individual ejecutando la traza de pensamiento CoT (Chain of Thought).
        """
        return await SplitReasoner.decompose_document(raw_text, filename, use_llm=use_llm)

    async def process_high_volume_batch(
        self,
        batch_documents: List[Tuple[str, str]],  # Lista de tuplas: (raw_text, filename)
        generate_synthesis: bool = True,
        use_llm: bool = True
    ) -> HighVolumeBatchAnalysisResult:
        """
        Procesa de forma concurrente o por lotes múltiples documentos,
        los descompone, audita anomalías cruzadas y genera métricas agregadas en memoria.
        """
        import asyncio

        # 1. Descomposición concurrente de cada documento
        tasks = [
            SplitReasoner.decompose_document(raw_text, filename, use_llm=use_llm)
            for raw_text, filename in batch_documents
        ]
        decomposed_list: List[DecomposedInvoice] = await asyncio.gather(*tasks)

        # 2. Síntesis de razonamiento sobre el lote
        reasoning_insights = ""
        if generate_synthesis and decomposed_list:
            total_vol = sum(d.grand_total for d in decomposed_list)
            balanced_count = sum(1 for d in decomposed_list if d.is_balanced)
            suppliers_unique = len(set(d.supplier_tax_id for d in decomposed_list))
            reasoning_insights = (
                f"Lote auditado con {len(decomposed_list)} documentos ({suppliers_unique} proveedores únicos). "
                f"Volumen neto total: {round(total_vol, 2)}€. "
                f"Paridad contable: {balanced_count}/{len(decomposed_list)} documentos cuadrados con éxito "
                f"({round((balanced_count/len(decomposed_list))*100, 1)}%)."
            )

        # 3. Procesamiento y agregación analítica con DuckDB & Polars
        return self.decomposer.process_batch(
            invoices=decomposed_list,
            reasoning_insights=reasoning_insights
        )

    def execute_sql(self, query: str) -> List[Dict[str, Any]]:
        """
        Ejecuta consultas analíticas SQL en DuckDB sobre los datos tabulares cargados.
        """
        return self.decomposer.execute_analytical_query(query)

    def reconcile_bank_movements(
        self,
        bank_records: List[Dict[str, Any]],
        invoices: List[Dict[str, Any]],
        tolerance_cents: float = 0.05
    ):
        """
        Ejecuta conciliación bancaria bidireccional entre extractos y facturas.
        """
        from .financial_intelligence import FinancialIntelligenceEngine
        return FinancialIntelligenceEngine.reconcile_bank_movements(
            bank_records=bank_records,
            invoices=invoices,
            tolerance_cents=tolerance_cents
        )

    def calculate_vat_prorata(
        self,
        taxable_turnover: float,
        exempt_turnover: float,
        asset_base: float,
        asset_useful_life_years: int = 5,
        amortization_method: str = "LINEAR"
    ):
        """
        Calcula la regla de Prorrata General de IVA (Art. 104 LIVA) y amortización de activos.
        """
        from .financial_intelligence import FinancialIntelligenceEngine
        return FinancialIntelligenceEngine.calculate_vat_prorata_and_amortization(
            taxable_turnover=taxable_turnover,
            exempt_turnover=exempt_turnover,
            asset_base=asset_base,
            asset_useful_life_years=asset_useful_life_years,
            amortization_method=amortization_method
        )

    def audit_forensic_fraud(
        self,
        invoices: List[Dict[str, Any]],
        smurfing_threshold: float = 1000.0,
        cluster_window_days: int = 5
    ):
        """
        Auditoría Forense de Smurfing, clustering de importes redondos y riesgo de concentración.
        """
        from .financial_intelligence import FinancialIntelligenceEngine
        return FinancialIntelligenceEngine.evaluate_forensic_fraud_and_smurfing(
            invoices=invoices,
            smurfing_threshold=smurfing_threshold,
            cluster_window_days=cluster_window_days
        )
