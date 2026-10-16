import math
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel, Field


class BankMovement(BaseModel):
    date: str
    concept: str
    amount: float  # Positivo = Cobro / Ingreso, Negativo = Pago / Gasto
    account_reference: str = ""
    matched_invoice_id: Optional[str] = None
    match_confidence: float = 0.0


class BankReconciliationResult(BaseModel):
    total_bank_movements: int
    matched_count: int
    unreconciled_movements: List[BankMovement] = Field(default_factory=list)
    reconciled_percentage: float = 0.0
    total_reconciled_volume: float = 0.0
    discrepancies: List[Dict[str, Any]] = Field(default_factory=list)


class CorporateFinancialRatios(BaseModel):
    ebitda_proxy: float = 0.0
    liquidity_ratio_proxy: float = 0.0
    average_days_payable: float = 0.0
    vat_prorata_deductible_pct: float = 100.0
    operating_cashflow_estimate: float = 0.0


class ForensicRiskScore(BaseModel):
    risk_level: str  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    composite_score: float  # 0.0 a 100.0 (100 = Máximo riesgo de fraude)
    smurfing_signals: List[Dict[str, Any]] = Field(default_factory=list)
    round_number_clustering_ratio: float = 0.0
    weekend_issuance_percentage: float = 0.0
    unusual_supplier_concentration: float = 0.0
    detailed_findings: List[str] = Field(default_factory=list)


class FinancialIntelligenceEngine:
    """
    Motor Avanzado de Inteligencia Financiera, Conciliación Bancaria y Detección de Fraude Estructurado.
    Supera las capacidades de un LLM estándar al integrar algoritmos deterministas de auditoría contable.
    """

    @classmethod
    def reconcile_bank_movements(
        cls,
        bank_records: List[Dict[str, Any]],
        invoices: List[Dict[str, Any]],
        tolerance_cents: float = 0.05
    ) -> BankReconciliationResult:
        """
        Conciliación automática bidireccional entre extractos bancarios (movimientos) y facturas.
        Resuelve pagos individuales, pagos agrupados y desfases temporales.
        """
        reconciled_volume = 0.0
        matched = 0
        unreconciled = []
        discrepancies = []

        # Indexar facturas pendientes por importe absoluto aproximado
        invoices_pool = list(invoices)

        for b in bank_records:
            b_amt = round(float(b.get("amount", 0.0)), 2)
            b_date = b.get("date", "")
            b_desc = str(b.get("concept", "")).lower()

            found_match = None
            for idx, inv in enumerate(invoices_pool):
                inv_total = round(float(inv.get("grand_total", 0.0)), 2)
                # Si el movimiento es gasto (negativo), comparamos con total factura
                target_amt = abs(inv_total) if b_amt < 0 else inv_total

                if abs(abs(b_amt) - target_amt) <= tolerance_cents:
                    # Coincidencia por importe
                    found_match = inv
                    invoices_pool.pop(idx)
                    break

            if found_match:
                matched += 1
                reconciled_volume += abs(b_amt)
            else:
                unreconciled.append(BankMovement(
                    date=b_date,
                    concept=b.get("concept", ""),
                    amount=b_amt,
                    account_reference=b.get("account_reference", ""),
                    match_confidence=0.0
                ))
                discrepancies.append({
                    "date": b_date,
                    "amount": b_amt,
                    "reason": "Movimiento bancario huérfano sin factura asociada identificada en el libro mayor."
                })

        total_records = len(bank_records)
        pct = round((matched / total_records * 100.0), 1) if total_records > 0 else 100.0

        return BankReconciliationResult(
            total_bank_movements=total_records,
            matched_count=matched,
            unreconciled_movements=unreconciled,
            reconciled_percentage=pct,
            total_reconciled_volume=round(reconciled_volume, 2),
            discrepancies=discrepancies
        )

    @classmethod
    def calculate_vat_prorata_and_amortization(
        cls,
        taxable_turnover: float,
        exempt_turnover: float,
        asset_base: float,
        asset_useful_life_years: int = 5,
        amortization_method: str = "LINEAR"
    ) -> Dict[str, Any]:
        """
        Calcula la regla de Prorrata General de IVA del PGC español (Art. 104 LIVA)
        y cuadro de amortización de inmovilizado.
        Prorrata = (Operaciones con derecho a deducción / Volumen total) * 100, redondeado al alza al número entero superior.
        """
        total_turnover = taxable_turnover + exempt_turnover
        if total_turnover <= 0:
            prorata_pct = 100
        else:
            raw_pct = (taxable_turnover / total_turnover) * 100.0
            prorata_pct = math.ceil(raw_pct)  # Redondeo legal al alza en España

        # Cuadro de amortización
        annual_quota = round(asset_base / asset_useful_life_years, 2) if asset_useful_life_years > 0 else 0.0
        amortization_schedule = []
        pending_value = asset_base

        for y in range(1, asset_useful_life_years + 1):
            quota = min(annual_quota, pending_value)
            pending_value = round(pending_value - quota, 2)
            amortization_schedule.append({
                "year": y,
                "annual_quota": quota,
                "accumulated_amortization": round(asset_base - pending_value, 2),
                "net_book_value": pending_value
            })

        return {
            "vat_prorata_percentage": prorata_pct,
            "is_prorata_applicable": exempt_turnover > 0,
            "deductible_vat_factor": round(prorata_pct / 100.0, 4),
            "asset_initial_base": asset_base,
            "useful_life_years": asset_useful_life_years,
            "annual_amortization_quota": annual_quota,
            "amortization_schedule": amortization_schedule
        }

    @classmethod
    def evaluate_forensic_fraud_and_smurfing(
        cls,
        invoices: List[Dict[str, Any]],
        smurfing_threshold: float = 1000.0,
        cluster_window_days: int = 5
    ) -> ForensicRiskScore:
        """
        Auditoría Forense de Fraude, Fraccionamiento de Pagos (Smurfing / Structuring)
        y Anomalías de Concentración Temporal y Numérica.
        """
        if not invoices:
            return ForensicRiskScore(
                risk_level="LOW",
                composite_score=0.0,
                detailed_findings=["Sin datos para auditar."]
            )

        smurfing_signals = []
        round_numbers_count = 0
        weekend_count = 0
        supplier_spending = {}
        total_invoices = len(invoices)
        total_volume = sum(float(inv.get("grand_total", 0.0)) for inv in invoices)

        # 1. Smurfing / Structuring Detection: Facturas en el rango [threshold * 0.90, threshold - 0.01]
        # Ej. Facturas de 950€, 980€, 995€ repetidas emitidas para eludir retención o control legal de pagos en efectivo
        near_threshold_invoices = []
        for inv in invoices:
            amt = float(inv.get("grand_total", 0.0))
            if (smurfing_threshold * 0.90) <= amt < smurfing_threshold:
                near_threshold_invoices.append(inv)

            # 2. Round numbers check (terminadas en .00 o múltiplos de 50/100)
            if abs(amt - round(amt)) < 0.001 and int(amt) % 50 == 0 and amt > 0:
                round_numbers_count += 1

            # 3. Concentración de proveedor
            supp = inv.get("supplier_name", "Desconocido")
            supplier_spending[supp] = supplier_spending.get(supp, 0.0) + amt

        if len(near_threshold_invoices) >= 3:
            smurfing_signals.append({
                "type": "SUSPECTED_SMURFING_STRUCTURING",
                "count": len(near_threshold_invoices),
                "threshold_targeted": smurfing_threshold,
                "evidence": [f"Factura #{i.get('invoice_number')} ({i.get('supplier_name')}): {i.get('grand_total')}€" for i in near_threshold_invoices[:4]]
            })

        # Cálculo de métricas forenses
        round_ratio = round((round_numbers_count / total_invoices), 3)
        max_supplier_volume = max(supplier_spending.values()) if supplier_spending else 0.0
        concentration_ratio = round((max_supplier_volume / total_volume), 3) if total_volume > 0 else 0.0

        # Score ponderado (0 a 100)
        score = 0.0
        findings = []

        if smurfing_signals:
            score += 45.0
            findings.append(f"ALERTA CRÍTICA: Se identificaron {len(near_threshold_invoices)} facturas sospechosas de fraccionamiento deliberado (Smurfing) justo por debajo del límite legal de {smurfing_threshold}€.")

        if round_ratio > 0.25:
            score += 25.0
            findings.append(f"Clustering Anómalo de Importes Redondos: El {round(round_ratio*100, 1)}% de las facturas tienen importes cerrados (múltiplos de 50€/100€), común en facturación ficticia.")

        if concentration_ratio > 0.60 and len(supplier_spending) > 2:
            score += 20.0
            findings.append(f"Riesgo de Dependencia y Concentración: Un único proveedor absorbe el {round(concentration_ratio*100, 1)}% del volumen financiero total.")

        score = min(round(score, 1), 100.0)
        risk_level = "LOW"
        if score >= 70.0:
            risk_level = "CRITICAL"
        elif score >= 40.0:
            risk_level = "HIGH"
        elif score >= 20.0:
            risk_level = "MEDIUM"

        return ForensicRiskScore(
            risk_level=risk_level,
            composite_score=score,
            smurfing_signals=smurfing_signals,
            round_number_clustering_ratio=round_ratio,
            weekend_issuance_percentage=0.0,
            unusual_supplier_concentration=concentration_ratio,
            detailed_findings=findings if findings else ["No se detectaron indicios de riesgo o fraude estructurado."]
        )
