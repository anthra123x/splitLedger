"""
Analista de Datos - Motor Neuro-Simbólico de Razonamiento, Auditoría Forense y Descomposición Financiera.
Repositorio Oficial: https://github.com/anthra123x/analista-de-datos
"""

from typing import List, Dict, Any, Tuple, Optional
import asyncio

from app.core.engine import SplitReasonerEngine
from app.models.schemas import (
    DecomposedInvoice,
    HighVolumeBatchAnalysisResult,
    InvoiceLineItem,
    TaxBreakdownItem,
    DoubleEntrySeat,
    AnomalyItem
)
from app.core.tax_id_validator import FiscalTaxIdValidator, TaxIdValidationResult
from app.core.temporal_punctuality import TemporalPunctualityEngine, TemporalPunctualityResult
from app.core.currency_normalizer import CurrencyTriangulationEngine, CurrencyConversionResult
from app.core.financial_intelligence import FinancialIntelligenceEngine, BankReconciliationResult, ForensicRiskScore
from app.core.complex_math_solver import ComplexMathForensicSolver, MathAuditDiagnosis
from app.core.anomaly_detector import FinancialAnomalyDetector

__version__ = "1.0.0"
__all__ = [
    "AnalistaDeDatos",
    "DecomposedInvoice",
    "HighVolumeBatchAnalysisResult",
    "InvoiceLineItem",
    "TaxBreakdownItem",
    "DoubleEntrySeat",
    "AnomalyItem",
    "FiscalTaxIdValidator",
    "TaxIdValidationResult",
    "TemporalPunctualityEngine",
    "TemporalPunctualityResult",
    "CurrencyTriangulationEngine",
    "CurrencyConversionResult",
    "FinancialIntelligenceEngine",
    "BankReconciliationResult",
    "ForensicRiskScore",
    "ComplexMathForensicSolver",
    "MathAuditDiagnosis",
    "FinancialAnomalyDetector"
]


class AnalistaDeDatos:
    """
    Cliente unificado de alto nivel para integración en cualquier sistema, herramienta, script o pipeline ETL.
    
    Ejemplo de uso:
    >>> from analista_de_datos import AnalistaDeDatos
    >>> analista = AnalistaDeDatos()
    >>> doc = analista.analizar("PROVEEDOR: AWS... Total: 121.00 EUR")
    >>> print(doc.invoice_number, doc.grand_total, doc.is_balanced)
    """

    def __init__(self):
        self._engine = SplitReasonerEngine()

    def analizar(
        self,
        raw_text: str,
        document_name: str = "documento.txt",
        use_llm: bool = False
    ) -> DecomposedInvoice:
        """
        Analiza y descompone un documento individual de forma síncrona.
        Genera traza de pensamiento CoT, auditoría de partida doble y asiento contable PGC.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(self._engine.process_document(raw_text, filename=document_name, use_llm=use_llm))
        else:
            return asyncio.run(self._engine.process_document(raw_text, filename=document_name, use_llm=use_llm))

    async def analizar_async(
        self,
        raw_text: str,
        document_name: str = "documento.txt",
        use_llm: bool = False
    ) -> DecomposedInvoice:
        """
        Versión asíncrona nativa para frameworks como FastAPI, Aiohttp o Celery.
        """
        return await self._engine.process_document(raw_text, filename=document_name, use_llm=use_llm)

    def analizar_lote(
        self,
        documents: List[Tuple[str, str]],
        generate_synthesis: bool = True,
        use_llm: bool = False
    ) -> HighVolumeBatchAnalysisResult:
        """
        Procesa de forma masiva miles de documentos en memoria utilizando DuckDB y Polars.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(self._engine.process_high_volume_batch(documents, generate_synthesis=generate_synthesis, use_llm=use_llm))
        else:
            return asyncio.run(self._engine.process_high_volume_batch(documents, generate_synthesis=generate_synthesis, use_llm=use_llm))

    def conciliar_banco(
        self,
        bank_records: List[Dict[str, Any]],
        invoices: List[Dict[str, Any]],
        tolerance_cents: float = 0.05
    ) -> BankReconciliationResult:
        """
        Conciliación automática bidireccional entre extractos bancarios y facturas del libro mayor.
        """
        return self._engine.reconcile_bank_movements(bank_records, invoices, tolerance_cents)

    def calcular_prorrata_iva(
        self,
        taxable_turnover: float,
        exempt_turnover: float,
        asset_base: float,
        useful_life_years: int = 5,
        amortization_method: str = "LINEAR"
    ) -> Dict[str, Any]:
        """
        Calcula la regla de Prorrata General de IVA (Art. 104 LIVA) y cuadro de amortización de inmovilizado.
        """
        return self._engine.calculate_vat_prorata(
            taxable_turnover=taxable_turnover,
            exempt_turnover=exempt_turnover,
            asset_base=asset_base,
            asset_useful_life_years=useful_life_years,
            amortization_method=amortization_method
        )

    def auditar_fraude(
        self,
        invoices: List[Dict[str, Any]],
        smurfing_threshold: float = 1000.0,
        cluster_window_days: int = 5
    ) -> ForensicRiskScore:
        """
        Auditoría de riesgo de fraude, fraccionamiento deliberado (Smurfing/Structuring) y clustering numérico.
        """
        return self._engine.audit_forensic_fraud(
            invoices=invoices,
            smurfing_threshold=smurfing_threshold,
            cluster_window_days=cluster_window_days
        )

    def auditar_benford(self, invoices_or_amounts: List[Any]) -> Dict[str, Any]:
        """
        Auditoría forense de la distribución del primer dígito según la Ley de Benford e índice MAD de Nigrini.
        """
        return FinancialAnomalyDetector.audit_benford_law_distribution(invoices_or_amounts)

    def validar_nif_cif(self, tax_id: str) -> TaxIdValidationResult:
        """
        Validación matemática estricta de checksum y dígito de control para DNI, NIE, CIF y VIES europeo.
        """
        return FiscalTaxIdValidator.validate_tax_id(tax_id)

    def normalizar_temporalidad(
        self,
        raw_text: str,
        explicit_date: Optional[str] = None,
        explicit_due_date: Optional[str] = None
    ) -> TemporalPunctualityResult:
        """
        Normaliza fechas a ISO 8601 y evalúa plazos de pago, vencimientos y días de mora.
        """
        return TemporalPunctualityEngine.evaluate_punctuality(raw_text, explicit_date, explicit_due_date)

    def convertir_divisa(self, amount: float, currency: str, custom_rate: Optional[float] = None) -> CurrencyConversionResult:
        """
        Triangulación a EUR aplicando tipos oficiales del BCE y redondeo Banker's Rounding (Round-Half-Even).
        """
        return CurrencyTriangulationEngine.normalize_to_eur(amount, currency, custom_rate)

    def ejecutar_sql(self, query: str) -> List[Dict[str, Any]]:
        """
        Ejecuta consultas analíticas SQL en DuckDB sobre los datos cargados en memoria.
        """
        return self._engine.execute_sql(query)
