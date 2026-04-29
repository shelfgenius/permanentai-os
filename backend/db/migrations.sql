-- TechQuery Database Migrations
-- Run once against a fresh PostgreSQL database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Full-text search configuration
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS techquery_fts (COPY = english);
ALTER TEXT SEARCH CONFIGURATION techquery_fts
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, english_stem;

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
    CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'indexed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE asset_type_enum AS ENUM ('3d_model', 'blueprint', 'schematic', 'image', 'cad', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- technical_docs  — vectorised manual / documentation content
-- ============================================================
CREATE TABLE IF NOT EXISTS technical_docs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename        VARCHAR(512) NOT NULL,
    title           VARCHAR(1024),
    category        VARCHAR(64),
    source_url      TEXT,
    file_type       VARCHAR(32),
    file_size_bytes INTEGER,
    storage_key     TEXT,
    status          doc_status NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    chunk_count     INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_technical_docs_category    ON technical_docs (category);
CREATE INDEX IF NOT EXISTS ix_technical_docs_status      ON technical_docs (status);
CREATE INDEX IF NOT EXISTS ix_technical_docs_cat_status  ON technical_docs (category, status);

-- ============================================================
-- document_chunks  — individual vectorised text chunks
-- ============================================================
CREATE TABLE IF NOT EXISTS document_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES technical_docs(id) ON DELETE CASCADE,
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    content_tokens  INTEGER,
    embedding       VECTOR(384),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_doc_chunks_doc_id     ON document_chunks (document_id);
CREATE INDEX IF NOT EXISTS ix_doc_chunks_doc_chunk  ON document_chunks (document_id, chunk_index);

-- HNSW index for fast approximate nearest-neighbour search (cosine similarity)
CREATE INDEX IF NOT EXISTS ix_doc_chunks_embedding_hnsw
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- GIN index for full-text keyword search (BM25-style via tsvector)
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS fts_vector TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('techquery_fts', content)) STORED;

CREATE INDEX IF NOT EXISTS ix_doc_chunks_fts
    ON document_chunks USING GIN (fts_vector);

-- Trigram index for fuzzy string matching
CREATE INDEX IF NOT EXISTS ix_doc_chunks_trgm
    ON document_chunks USING GIN (content gin_trgm_ops);

-- ============================================================
-- parts_inventory  — structured component specifications
-- ============================================================
CREATE TABLE IF NOT EXISTS parts_inventory (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_number         VARCHAR(256) NOT NULL UNIQUE,
    name                VARCHAR(512) NOT NULL,
    description         TEXT,
    category            VARCHAR(64),
    manufacturer        VARCHAR(256),
    specifications      JSONB DEFAULT '{}',
    unit                VARCHAR(32),
    quantity_on_hand    NUMERIC(12,3) DEFAULT 0,
    unit_cost           NUMERIC(12,4),
    supplier_info       JSONB DEFAULT '{}',
    tags                TEXT[] DEFAULT '{}',
    embedding           VECTOR(384),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_parts_part_number  ON parts_inventory (part_number);
CREATE INDEX IF NOT EXISTS ix_parts_category     ON parts_inventory (category);
CREATE INDEX IF NOT EXISTS ix_parts_tags         ON parts_inventory USING GIN (tags);
CREATE INDEX IF NOT EXISTS ix_parts_specs        ON parts_inventory USING GIN (specifications);

CREATE INDEX IF NOT EXISTS ix_parts_embedding_hnsw
    ON parts_inventory
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- asset_registry  — 3D/CAD file metadata
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_registry (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(512) NOT NULL,
    description      TEXT,
    asset_type       asset_type_enum NOT NULL,
    category         VARCHAR(64),
    storage_key      TEXT NOT NULL,
    storage_backend  VARCHAR(32) DEFAULT 'minio',
    file_format      VARCHAR(32),
    file_size_bytes  INTEGER,
    thumbnail_key    TEXT,
    version          VARCHAR(32) DEFAULT '1.0.0',
    tags             TEXT[] DEFAULT '{}',
    metadata         JSONB DEFAULT '{}',
    embedding        VECTOR(384),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_asset_type       ON asset_registry (asset_type);
CREATE INDEX IF NOT EXISTS ix_asset_category   ON asset_registry (category);
CREATE INDEX IF NOT EXISTS ix_asset_tags       ON asset_registry USING GIN (tags);

CREATE INDEX IF NOT EXISTS ix_asset_embedding_hnsw
    ON asset_registry
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- chat_sessions + chat_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          VARCHAR(64) PRIMARY KEY,
    title       VARCHAR(512) DEFAULT 'New Query',
    category    VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        message_role NOT NULL,
    content     TEXT NOT NULL,
    sources     JSONB DEFAULT '[]',
    token_count INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_chat_messages_session ON chat_messages (session_id, created_at);

-- ============================================================
-- Reciprocal Rank Fusion helper function
-- ============================================================
CREATE OR REPLACE FUNCTION rrf_score(semantic_rank INT, keyword_rank INT, k INT DEFAULT 60)
RETURNS FLOAT AS $$
    SELECT (1.0 / (k + semantic_rank)) + (1.0 / (k + keyword_rank));
$$ LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE;

-- ============================================================
-- updated_at auto-update trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['technical_docs','parts_inventory','asset_registry','chat_sessions']
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
             CREATE TRIGGER trg_%I_updated_at
             BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
            tbl, tbl, tbl, tbl
        );
    END LOOP;
END $$;
