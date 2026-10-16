import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load root .env or local .env
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if root_env.exists():
    load_dotenv(root_env)
load_dotenv()


class EngineConfig(BaseModel):
    app_name: str = "Split-Reasoner AI Engine"
    app_version: str = "1.0.0"
    port: int = int(os.getenv("AI_ENGINE_PORT", "8100"))
    host: str = os.getenv("AI_ENGINE_HOST", "0.0.0.0")

    # Database connection (Neon PostgreSQL or local SQLite)
    database_url: str = os.getenv("DATABASE_URL", os.getenv("DB_URL", ""))
    database_path: str = os.getenv("DATABASE_PATH", "./data/split_ledger.sqlite")

    # LLM Providers for Reasoning & Dataset Generation
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_DEFAULT_MODEL", "google/gemini-2.5-flash")
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")

    # Local / Fine-Tuned Model Configuration
    local_model_path: str = os.getenv("LOCAL_MODEL_PATH", "Qwen/Qwen2.5-7B-Instruct")
    use_local_model: bool = os.getenv("USE_LOCAL_MODEL", "false").lower() == "true"
    temperature: float = 0.1
    max_tokens: int = 4096


config = EngineConfig()
