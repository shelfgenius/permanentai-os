import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean,
    DateTime, JSON, ForeignKey, Index, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from db.database import Base
from config import get_settings

settings = get_settings()
EMBED_DIM = settings.embedding_dimension


class TechnicalDocument(Base):
    __tablename__ = "technical_docs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(512), nullable=False)
    title = Column(String(1024), nullable=True)
    category = Column(String(64), nullable=True, index=True)
    source_url = Column(Text, nullable=True)
    file_type = Column(String(32), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    storage_key = Column(Text, nullable=True)
    status = Column(
        SAEnum("pending", "processing", "indexed", "error", name="doc_status"),
        default="pending",
        nullable=False,
        index=True,
    )
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_technical_docs_category_status", "category", "status"),
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("technical_docs.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_tokens = Column(Integer, nullable=True)
    embedding = Column(Vector(EMBED_DIM), nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("TechnicalDocument", back_populates="chunks")

    __table_args__ = (
        Index("ix_doc_chunks_doc_chunk", "document_id", "chunk_index"),
    )


class PartsInventory(Base):
    __tablename__ = "parts_inventory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    part_number = Column(String(256), nullable=False, unique=True, index=True)
    name = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=True, index=True)
    manufacturer = Column(String(256), nullable=True)
    specifications = Column(JSON, default=dict)
    unit = Column(String(32), nullable=True)
    quantity_on_hand = Column(Float, default=0)
    unit_cost = Column(Float, nullable=True)
    supplier_info = Column(JSON, default=dict)
    tags = Column(ARRAY(String), default=list)
    embedding = Column(Vector(EMBED_DIM), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_parts_category", "category"),
    )


class AssetRegistry(Base):
    __tablename__ = "asset_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    asset_type = Column(
        SAEnum("3d_model", "blueprint", "schematic", "image", "cad", "other", name="asset_type_enum"),
        nullable=False,
        index=True,
    )
    category = Column(String(64), nullable=True, index=True)
    storage_key = Column(Text, nullable=False)
    storage_backend = Column(String(32), default="minio")
    file_format = Column(String(32), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    thumbnail_key = Column(Text, nullable=True)
    version = Column(String(32), default="1.0.0")
    tags = Column(ARRAY(String), default=list)
    metadata_ = Column("metadata", JSON, default=dict)
    embedding = Column(Vector(EMBED_DIM), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_asset_type_category", "asset_type", "category"),
    )


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True)
    title = Column(String(512), default="New Query")
    category = Column(String(64), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(64), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SAEnum("user", "assistant", "system", name="message_role"), nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=list)
    token_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("ChatSession", back_populates="messages")
