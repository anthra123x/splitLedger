from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    x: float = 0.0
    y: float = 0.0
    w: float = 0.0
    h: float = 0.0
    confidence: float = 1.0


class InvoiceLineItem(BaseModel):
    item_index: int = 1
    concept: str
    quantity: float = 1.0
    unit: str = "uds"
    unit_price: float = 0.0
    discount_amount: float = 0.0
    base_amount: float = 0.0
    tax_rate: float = 21.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    account_code: str = "629000"
    account_name: str = "Otros servicios"
    cost_center: str = "GENERAL"
    bounding_box: Optional[BoundingBox] = None
    notes: Optional[str] = None


class TaxBreakdownItem(BaseModel):
    tax_rate: float
    base_amount: float
    tax_amount: float
    surcharge_rate: float = 0.0  # Recargo de equivalencia (0.5%, 1.4%, 5.2%)
    surcharge_amount: float = 0.0


class JournalEntryLine(BaseModel):
    account_code: str
    account_name: str
    debit: float = 0.0   # Debe
    credit: float = 0.0  # Haber


class DoubleEntrySeat(BaseModel):
    seat_number: int = 1
    date: str
    concept: str
    lines: List[JournalEntryLine] = Field(default_factory=list)
    total_debit: float = 0.0
    total_credit: float = 0.0
    is_balanced: bool = True


class DecomposedInvoice(BaseModel):
    invoice_number: str
    supplier_name: str
    supplier_tax_id: str
    supplier_address: Optional[str] = ""
    supplier_postal_code: Optional[str] = ""
    supplier_city: Optional[str] = ""
    supplier_email: Optional[str] = ""
    supplier_phone: Optional[str] = ""
    customer_name: Optional[str] = ""
    customer_tax_id: Optional[str] = ""
    customer_address: Optional[str] = ""
    customer_postal_code: Optional[str] = ""
    customer_city: Optional[str] = ""
    customer_email: Optional[str] = ""
    customer_phone: Optional[str] = ""
    invoice_date: str
    due_date: Optional[str] = ""
    payment_method: Optional[str] = None
    iban: Optional[str] = None
    currency: str = "EUR"
    subtotal: float = 0.0
    tax_total: float = 0.0
    surcharge_total: float = 0.0
    retention_total: float = 0.0
    grand_total: float = 0.0
    confidence_score: float = 0.985
    composite_precision_score: float = 0.985
    is_balanced: bool = True
    mathematical_discrepancy: float = 0.0
    multi_tax_detected: bool = False
    tax_breakdown: List[TaxBreakdownItem] = Field(default_factory=list)
    journal_entry: Optional[DoubleEntrySeat] = None
    tax_id_validation: Optional[Dict[str, Any]] = None
    temporal_analysis: Optional[Dict[str, Any]] = None
    currency_conversion: Optional[Dict[str, Any]] = None
    field_confidence: Dict[str, float] = Field(default_factory=dict)
    items: List[InvoiceLineItem] = Field(default_factory=list)
    thinking_process: Optional[str] = Field(
        default=None,
        description="Reasoning trace (<think>...</think>) explaining the step-by-step forensic deduction"
    )
    audit_notes: List[str] = Field(default_factory=list)


class AnomalyItem(BaseModel):
    anomaly_type: str  # 'PARITY_MISMATCH', 'TAX_RATE_ANOMALY', 'PRICE_OUTLIER', 'DUPLICATE_SUSPICION', 'UNMAPPED_PGC'
    severity: str      # 'CRITICAL', 'WARNING', 'INFO'
    description: str
    affected_field: str
    expected_value: Optional[Any] = None
    detected_value: Optional[Any] = None
    confidence: float = 0.95


class HighVolumeBatchAnalysisResult(BaseModel):
    total_documents: int
    processed_count: int
    total_volume_amount: float
    total_tax_amount: float
    total_retention_amount: float
    balanced_percentage: float
    anomalies: List[AnomalyItem] = Field(default_factory=list)
    top_suppliers_by_volume: List[Dict[str, Any]] = Field(default_factory=list)
    tax_rate_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    cost_center_breakdown: List[Dict[str, Any]] = Field(default_factory=list)
    monthly_trend: List[Dict[str, Any]] = Field(default_factory=list)
    reasoning_insights: str = Field(
        default="",
        description="LLM analytical reasoning synthesis over the aggregate dataset"
    )
    processing_time_ms: float = 0.0


class TrainingDatasetEntry(BaseModel):
    id: str
    system_prompt: str
    user_prompt: str
    thinking_trace: str
    final_output: Dict[str, Any]
    domain_tags: List[str] = Field(default_factory=list)
