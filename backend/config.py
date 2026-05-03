import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TechQuery Backend"
    app_version: str = "1.0.0"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://techquery:password@localhost:5432/techquery"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # Embeddings
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    embedding_batch_size: int = 32

    # LLM
    llm_provider: str = "ollama"
    groq_api_key: str = ""
    gemini_api_key: str = ""
    mistral_api_key: str = ""
    together_api_key: str = ""
    elevenlabs_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"

    # RAG
    rag_top_k_semantic: int = 6
    rag_top_k_keyword: int = 6
    rag_rrf_k: int = 60
    rag_chunk_size: int = 512
    rag_chunk_overlap: int = 64
    rag_max_context_tokens: int = 3000

    # Storage (MinIO / S3)
    storage_backend: str = "minio"        # minio | s3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "techquery-assets"
    minio_secure: bool = False

    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    aws_s3_bucket: str = "techquery-assets"

    # NVIDIA NIM (cloud TTS + image)
    nvidia_api_key_tts:   str = ""
    nvidia_api_key_image: str = ""
    nvidia_nim_base_url:  str = "https://integrate.api.nvidia.com/v1"

    # Gmail / misc integrations
    gmail_token_path: str = "gmail_token.json"

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Ignore any extra keys added later to .env so the server never
        # refuses to start because of an unknown variable.
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
