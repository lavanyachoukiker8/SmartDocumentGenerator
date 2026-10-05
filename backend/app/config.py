from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from cryptography.fernet import Fernet


class Settings(BaseSettings):
    PROJECT_NAME: str = "ClubDocs Backend"
    API_V1_STR: str = "/api"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Base paths
    ROOT_DIR: Path = Path(__file__).resolve().parent.parent.parent
    BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BACKEND_DIR / "data"
    OUTPUTS_DIR: Path = BACKEND_DIR / "outputs"
    TEMPLATES_DIR: Path = ROOT_DIR / "templates"

    DATABASE_URL: str = f"sqlite:///{DATA_DIR / 'clubdocs.db'}"

    # Fernet encryption key for masked sensitive fields (default key if not provided)
    FERNET_KEY: str = "uXl_g4T0jL-vX9yD0w7uQk8M2bA6cD4eF8hJ0lP2rT4="

    # LibreOffice path for headless export (platform specific or default PATH search)
    LIBREOFFICE_PATH: str = "soffice"

    # Optional LLM API keys for AI extraction
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
