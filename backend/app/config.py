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

    # Fernet encryption key for masked sensitive fields (from env or generated in data/.fernet_key)
    FERNET_KEY: str | None = None

    # LibreOffice path for headless export (platform specific or default PATH search)
    LIBREOFFICE_PATH: str = "soffice"

    # LLM & Dev settings
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"
    GEMINI_API_KEY: str | None = None
    ENABLE_DEV_RESET: bool = False

    # Auth & JWT settings
    JWT_SECRET_KEY: str | None = None
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_or_create_fernet_key(data_dir: Path, env_key: str | None) -> str:
    if env_key and env_key.strip():
        return env_key.strip()
    data_dir.mkdir(parents=True, exist_ok=True)
    key_file = data_dir / ".fernet_key"
    if key_file.exists():
        key = key_file.read_text(encoding="utf-8").strip()
        if key:
            return key
    new_key = Fernet.generate_key().decode("utf-8")
    key_file.write_text(new_key, encoding="utf-8")
    return new_key


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
settings.TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
settings.FERNET_KEY = get_or_create_fernet_key(settings.DATA_DIR, settings.FERNET_KEY)

