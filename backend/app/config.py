from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "R2RA"
    debug: bool = False

    # SQLite for local dev; set DATABASE_URL=postgresql://... for production
    database_url: str = "sqlite:///./r2ra_dev.db"

    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 480  # 8-hour field shift

    content_dir: str = "../content"

    # Local file storage fallback (used when S3_EVIDENCE_BUCKET is not set)
    uploads_dir: str = "./uploads"
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB

    # S3 — leave blank to use local disk (dev default). Both names accepted:
    # AWS_S3_BUCKET (original, per docs/DEPLOY.md) or S3_EVIDENCE_BUCKET.
    s3_evidence_bucket: str = ""
    aws_s3_bucket: str = ""
    aws_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""

    # Debrief AI pipeline (Amazon Transcribe + Claude on Bedrock).
    # Requires S3 + IAM (transcribe:*TranscriptionJob, bedrock:InvokeModel)
    # + Bedrock model access enabled in the AWS console.
    bedrock_model_id: str = "anthropic.claude-opus-5"
    transcribe_language: str = "en-US"
    transcribe_timeout_sec: int = 1800  # 30 min ceiling for long debriefs
    max_audio_upload_bytes: int = 200 * 1024 * 1024  # ~2h of opus audio

    # Classification banner text — CUI Basic
    cui_banner: str = "CONTROLLED UNCLASSIFIED INFORMATION // BASIC"


settings = Settings()
