import os
import json
import sqlite3
from typing import Optional, List, Dict, Any
from pathlib import Path


class SQLiteJobStorage:
    """
    Almacenamiento persistente en SQLite para el gestor de trabajos asíncronos.
    Garantiza que el histórico de lotes, auditorías y telemetría sobreviva reinicios del servidor.
    """

    def __init__(self, db_path: str = "ai_engine/data/jobs.sqlite"):
        self.db_path = Path(db_path).resolve()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS async_jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    total_documents INTEGER NOT NULL,
                    processed_documents INTEGER NOT NULL,
                    progress_percentage REAL NOT NULL,
                    current_stage TEXT NOT NULL,
                    error_message TEXT,
                    result_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created ON async_jobs(created_at DESC)")

    def save_job(self, job_dict: Dict[str, Any]):
        result_json = json.dumps(job_dict.get("result"), ensure_ascii=False) if job_dict.get("result") else None
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO async_jobs (
                    job_id, status, created_at, updated_at, total_documents,
                    processed_documents, progress_percentage, current_stage,
                    error_message, result_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job_dict["job_id"],
                job_dict["status"],
                job_dict["created_at"],
                job_dict["updated_at"],
                job_dict["total_documents"],
                job_dict["processed_documents"],
                job_dict["progress_percentage"],
                job_dict["current_stage"],
                job_dict.get("error_message"),
                result_json
            ))

    def load_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM async_jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            data = dict(row)
            if data["result_json"]:
                data["result"] = json.loads(data["result_json"])
            del data["result_json"]
            return data

    def list_jobs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM async_jobs ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
            jobs = []
            for r in rows:
                d = dict(r)
                if d["result_json"]:
                    d["result"] = json.loads(d["result_json"])
                del d["result_json"]
                jobs.append(d)
            return jobs
