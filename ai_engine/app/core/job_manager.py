import time
import uuid
import asyncio
from typing import Dict, Any, Optional, List, Tuple, AsyncGenerator
from enum import Enum
from pydantic import BaseModel, Field

from .engine import SplitReasonerEngine
from .job_storage import SQLiteJobStorage
from ..models.schemas import HighVolumeBatchAnalysisResult


class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class JobState(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.QUEUED
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    total_documents: int = 0
    processed_documents: int = 0
    progress_percentage: float = 0.0
    current_stage: str = "En cola"
    error_message: Optional[str] = None
    result: Optional[HighVolumeBatchAnalysisResult] = None


class AsyncJobManager:
    """
    Gestor de trabajos asíncronos y colas de procesamiento masivo en segundo plano.
    Permite procesar lotes de 10.000 a 50.000+ documentos de forma desacoplada con telemetría en tiempo real (SSE)
    y persistencia transaccional en SQLite.
    """

    def __init__(self, engine: Optional[SplitReasonerEngine] = None, db_path: str = "ai_engine/data/jobs.sqlite"):
        self.engine = engine or SplitReasonerEngine()
        self.storage = SQLiteJobStorage(db_path=db_path)
        self.jobs: Dict[str, JobState] = {}
        self.chunk_size = 500  # Chunks de procesamiento en streaming

    def submit_job(
        self,
        documents: List[Tuple[str, str]],  # (raw_text, filename)
        use_llm: bool = False
    ) -> str:
        job_id = f"job-{uuid.uuid4().hex[:12]}"
        state = JobState(
            job_id=job_id,
            status=JobStatus.QUEUED,
            total_documents=len(documents),
            processed_documents=0,
            progress_percentage=0.0,
            current_stage="En cola para procesamiento en segundo plano"
        )
        self.jobs[job_id] = state
        self.storage.save_job(state.model_dump())

        # Lanzar tarea en segundo plano si hay un event loop activo
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._execute_job(job_id, documents, use_llm))
        except RuntimeError:
            # En contextos sincrónicos de prueba donde no hay loop corriendo
            pass
        return job_id

    def get_job(self, job_id: str) -> Optional[JobState]:
        if job_id in self.jobs:
            return self.jobs[job_id]
        # Recuperar de base de datos persistente SQLite si se reinició el servidor
        saved = self.storage.load_job(job_id)
        if saved:
            state = JobState(**saved)
            self.jobs[job_id] = state
            return state
        return None

    def list_jobs(self, limit: int = 20) -> List[JobState]:
        persisted = self.storage.list_jobs(limit=limit)
        return [JobState(**j) for j in persisted]

    async def _execute_job(
        self,
        job_id: str,
        documents: List[Tuple[str, str]],
        use_llm: bool
    ):
        state = self.jobs[job_id]
        state.status = JobStatus.PROCESSING
        state.updated_at = time.time()
        state.current_stage = "Iniciando descomposición en streaming"

        try:
            total = len(documents)
            all_decomposed = []

            # Procesamiento en chunks para optimizar memoria RAM
            for i in range(0, total, self.chunk_size):
                chunk = documents[i:i + self.chunk_size]
                chunk_index = (i // self.chunk_size) + 1
                total_chunks = (total + self.chunk_size - 1) // self.chunk_size

                state.current_stage = f"Procesando lote {chunk_index}/{total_chunks} ({len(chunk)} docs)"
                state.updated_at = time.time()

                # Descomposición concurrente del chunk
                tasks = [
                    self.engine.process_document(raw_text, fname, use_llm=use_llm)
                    for raw_text, fname in chunk
                ]
                decomposed_chunk = await asyncio.gather(*tasks)
                all_decomposed.extend(decomposed_chunk)

                state.processed_documents = len(all_decomposed)
                state.progress_percentage = round((len(all_decomposed) / total) * 100.0, 1)
                self.storage.save_job(state.model_dump())

            # Etapa de Agregación Columnar con DuckDB + Polars
            state.current_stage = "Ejecutando cálculos vectorizados en DuckDB y auditoría Benford"
            state.updated_at = time.time()

            result = self.engine.decomposer.process_batch(
                invoices=all_decomposed,
                reasoning_insights=f"Lote asíncrono {job_id}: {total} documentos procesados con éxito."
            )

            state.result = result
            state.status = JobStatus.COMPLETED
            state.current_stage = "Finalizado con éxito"
            state.progress_percentage = 100.0
            state.updated_at = time.time()
            self.storage.save_job(state.model_dump())

        except Exception as e:
            state.status = JobStatus.FAILED
            state.error_message = str(e)
            state.current_stage = "Fallo en ejecución"
            state.updated_at = time.time()
            self.storage.save_job(state.model_dump())

    async def stream_job_events(self, job_id: str) -> AsyncGenerator[str, None]:
        """
        Generador asíncrono para Server-Sent Events (SSE).
        Emite actualizaciones de progreso en tiempo real hasta que el trabajo termina.
        """
        while True:
            state = self.get_job(job_id)
            if not state:
                yield f"data: {{\"error\": \"Trabajo {job_id} no encontrado\"}}\n\n"
                break

            yield f"data: {state.model_dump_json()}\n\n"

            if state.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                break

            await asyncio.sleep(0.3)


# Singleton del gestor de trabajos
job_manager = AsyncJobManager()
