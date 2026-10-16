from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import config
from .core.engine import SplitReasonerEngine
from .models.schemas import DecomposedInvoice, HighVolumeBatchAnalysisResult
from .training.dataset_generator import DatasetGenerator

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("split_reasoner")

app = FastAPI(
    title=config.app_name,
    version=config.app_version,
    description="Motor Neuro-Simbólico de Razonamiento, Auditoría Forense y Descomposición de Grandes Volúmenes de Información"
)

# OWASP Security Headers & Payload Size Guard Middleware
class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 50MB payload limit check
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 50 * 1024 * 1024:
            return JSONResponse(
                status_code=413,
                content={"status": "error", "message": "Payload demasiado grande (límite 50MB)."}
            )

        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized Safe Exception Handler (OWASP Zero-Leakage)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"[Unhandled Server Error on {request.url.path}]: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Error interno en el procesamiento analítico."}
    )

engine = SplitReasonerEngine()


class DecomposeTextRequest(BaseModel):
    raw_text: str
    document_name: str = "documento.txt"
    use_llm: bool = False


class BatchTextItem(BaseModel):
    raw_text: str
    filename: str


class BatchDecomposeRequest(BaseModel):
    documents: List[BatchTextItem]
    generate_synthesis: bool = True
    use_llm: bool = False


class SqlQueryRequest(BaseModel):
    sql_query: str


class DatasetExportRequest(BaseModel):
    count: int = 100
    output_path: str = "ai_engine/data/training_dataset.jsonl"


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": config.app_name,
        "version": config.app_version,
        "reasoning_model": config.openrouter_model,
        "database_configured": bool(config.database_url or config.database_path)
    }


@app.post("/api/v1/decompose", response_model=DecomposedInvoice)
async def decompose_document(payload: DecomposeTextRequest):
    """
    Descompone un documento y devuelve la traza de pensamiento <think> junto al JSON estructurado.
    """
    if not payload.raw_text.strip():
        raise HTTPException(status_code=400, detail="El texto del documento no puede estar vacío.")
    
    return await engine.process_document(
        raw_text=payload.raw_text,
        filename=payload.document_name,
        use_llm=payload.use_llm
    )


@app.post("/api/v1/batch/analyze", response_model=HighVolumeBatchAnalysisResult)
async def analyze_batch(payload: BatchDecomposeRequest):
    """
    Descompone un lote masivo de documentos y genera análisis estadístico y forense con DuckDB + Polars.
    """
    if not payload.documents:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un documento en el lote.")

    batch = [(doc.raw_text, doc.filename) for doc in payload.documents]
    return await engine.process_high_volume_batch(
        batch_documents=batch,
        generate_synthesis=payload.generate_synthesis,
        use_llm=payload.use_llm
    )


@app.post("/api/v1/query/sql")
def execute_sql(payload: SqlQueryRequest):
    """
    Ejecuta consultas analíticas SQL en memoria sobre los datos descompuestos.
    """
    try:
        return engine.execute_sql(payload.sql_query)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en consulta SQL: {str(e)}")


@app.post("/api/v1/dataset/generate")
def generate_training_dataset(payload: DatasetExportRequest):
    """
    Genera y exporta un dataset sintético estructurado en formato ChatML para Fine-Tuning.
    """
    try:
        saved_path = DatasetGenerator.export_dataset(
            count=payload.count,
            output_file=payload.output_path
        )
        return {
            "status": "success",
            "samples_generated": payload.count,
            "dataset_file": saved_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando dataset: {str(e)}")


class BankReconciliationRequest(BaseModel):
    bank_records: List[Dict[str, Any]]
    invoices: List[Dict[str, Any]]
    tolerance_cents: float = 0.05


class ProrataAmortizationRequest(BaseModel):
    taxable_turnover: float
    exempt_turnover: float = 0.0
    asset_base: float
    asset_useful_life_years: int = 5
    amortization_method: str = "LINEAR"


class FraudAuditRequest(BaseModel):
    invoices: List[Dict[str, Any]]
    smurfing_threshold: float = 1000.0
    cluster_window_days: int = 5


@app.post("/api/v1/finance/reconcile-bank")
def reconcile_bank(payload: BankReconciliationRequest):
    """
    Conciliación bancaria bidireccional entre extractos bancarios y facturas.
    """
    return engine.reconcile_bank_movements(
        bank_records=payload.bank_records,
        invoices=payload.invoices,
        tolerance_cents=payload.tolerance_cents
    )


@app.post("/api/v1/finance/prorata-amortization")
def calculate_vat_prorata(payload: ProrataAmortizationRequest):
    """
    Calcula la regla de Prorrata General de IVA (Art. 104 LIVA) y cuadro de amortización.
    """
    return engine.calculate_vat_prorata(
        taxable_turnover=payload.taxable_turnover,
        exempt_turnover=payload.exempt_turnover,
        asset_base=payload.asset_base,
        asset_useful_life_years=payload.asset_useful_life_years,
        amortization_method=payload.amortization_method
    )


@app.post("/api/v1/finance/fraud-audit")
def audit_forensic_fraud(payload: FraudAuditRequest):
    """
    Auditoría Forense de Smurfing, importes redondos y riesgo de concentración.
    """
    return engine.audit_forensic_fraud(
        invoices=payload.invoices,
        smurfing_threshold=payload.smurfing_threshold,
        cluster_window_days=payload.cluster_window_days
    )


# ---------------------------------------------------------
# SISTEMA DE COLAS Y TRABAJOS ASÍNCRONOS (50.000+ FACTURAS)
# ---------------------------------------------------------
from starlette.responses import StreamingResponse
from .core.job_manager import job_manager, JobState


@app.post("/api/v1/jobs/submit")
async def submit_async_job(payload: BatchDecomposeRequest):
    """
    Encola un lote masivo (hasta 50.000+ documentos) para procesamiento asíncrono desacoplado.
    Devuelve inmediatamente un job_id y estado inicial.
    """
    if not payload.documents:
        raise HTTPException(status_code=400, detail="Debe enviar al menos un documento en el lote.")

    docs = [(d.raw_text, d.filename) for d in payload.documents]
    job_id = job_manager.submit_job(docs, use_llm=payload.use_llm)
    state = job_manager.get_job(job_id)

    return {
        "status": "submitted",
        "job_id": job_id,
        "total_documents": len(docs),
        "tracking_url": f"/api/v1/jobs/{job_id}",
        "stream_url": f"/api/v1/jobs/{job_id}/stream",
        "initial_state": state
    }


@app.get("/api/v1/jobs/{job_id}", response_model=JobState)
def get_job_status(job_id: str):
    """
    Consulta el estado y progreso de un trabajo en segundo plano.
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Trabajo {job_id} no encontrado.")
    return job


@app.get("/api/v1/jobs/{job_id}/stream")
async def stream_job_progress(job_id: str):
    """
    Transmite telemetría en tiempo real mediante Server-Sent Events (SSE).
    """
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Trabajo {job_id} no encontrado.")

    return StreamingResponse(
        job_manager.stream_job_events(job_id),
        media_type="text/event-stream"
    )


@app.get("/api/v1/jobs")
def list_active_jobs(limit: int = 20):
    """
    Lista los últimos trabajos procesados o en ejecución.
    """
    return job_manager.list_jobs(limit=limit)
