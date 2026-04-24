from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "R2RA"
    debug: bool = False

    database_url: str = "sqlite+aiosqlite:///./r2ra_dev.db"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 480  # 8-hour field shift

    content_dir: str = "../content"

    # Classification banner text — CUI Basic
    cui_banner: str = "CONTROLLED UNCLASSIFIED INFORMATION // BASIC"


settings = Settings()
