# TechQuery — Technical AI Desktop Assistant

A standalone Electron desktop application for precision technical queries across maritime, electrical, construction, DIY, 3D modeling, interior design, 3D printing, and prototyping domains.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron (Node.js main process)                        │
│    • Spawns Python sidecar on startup                   │
│    • Serves frontend via Vite (dev) or static (prod)    │
├─────────────────────────────────────────────────────────┤
│  React + Tailwind CSS  (renderer process)               │
│    • Claude-style dark UI with Framer Motion            │
│    • Zustand global state                               │
│    • SSE streaming chat feed                            │
├─────────────────────────────────────────────────────────┤
│  Python / FastAPI  (sidecar on :8000)                   │
│    • RAG pipeline: embed → RRF search → LLM stream      │
│    • Routers: /chat  /knowledge  /search                │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector                                  │
│    • technical_docs + document_chunks (HNSW + FTS)      │
│    • parts_inventory (structured specs)                 │
│    • asset_registry (3D/CAD file metadata)              │
├─────────────────────────────────────────────────────────┤
│  MinIO / AWS S3  (object storage)                       │
│    • Raw documents, 3D models, blueprints               │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | Electron, Vite |
| Python | ≥ 3.11 | FastAPI backend |
| PostgreSQL | ≥ 15 | with `pgvector` extension |
| MinIO | latest | or AWS S3 credentials |

---

## Quick Start

### 1. Database Setup

```sql
-- In psql as superuser:
CREATE USER techquery WITH PASSWORD 'password';
CREATE DATABASE techquery OWNER techquery;
\c techquery
CREATE EXTENSION vector;
CREATE EXTENSION pg_trgm;
CREATE EXTENSION unaccent;
```

Run the migration script:
```bash
psql -U techquery -d techquery -f backend/db/migrations.sql
```

### 2. MinIO Setup (optional — for file storage)

```bash
# Docker (quickest)
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

### 3. Backend Configuration

```bash
cp .env.example backend/.env
# Edit backend/.env — set DATABASE_URL, LLM_PROVIDER, API keys
```

### 4. Install Python Dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

### 5. Install Node Dependencies

```bash
# Root (Electron)
npm install

# Frontend (React)
cd frontend && npm install
```

### 6. Run in Development Mode

```bash
# Terminal 1 — Python backend
cd backend
python main.py

# Terminal 2 — Frontend + Electron
npm run dev
```

Or with one command (requires both Python and npm on PATH):
```bash
npm run dev:backend &
npm run dev
```

---

## LLM Provider Selection

Edit `backend/.env`:

```env
# Use OpenAI GPT-4o-mini (default)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Use Anthropic Claude
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Use local Ollama (no API key)
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

---

## Adding Documents to the Knowledge Base

1. Open the app → click **Knowledge** tab in the sidebar.
2. Click **Add Documents** → drag & drop PDF, DOCX, TXT, MD, CSV, or JSON files.
3. Assign a category (optional — auto-detected if omitted).
4. The backend will: upload to MinIO → parse → chunk → embed → store in pgvector.
5. Status updates to **indexed** when complete.

---

## Project Structure

```
retail-engine/
├── electron/
│   ├── main.js           ← Electron main process, Python sidecar launcher
│   └── preload.js        ← Context bridge (IPC)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Logo.jsx          ← Animated SVG (wrench + compass)
│   │   │   ├── Sidebar.jsx       ← Collapsible categories + sessions
│   │   │   ├── ChatFeed.jsx      ← SSE streaming chat feed
│   │   │   ├── InputBox.jsx      ← Floating expandable input
│   │   │   ├── MessageBubble.jsx ← Markdown + syntax highlighting
│   │   │   └── KnowledgeBase.jsx ← Document management UI
│   │   ├── store/useStore.js     ← Zustand global state
│   │   └── App.jsx
│   └── package.json
├── backend/
│   ├── main.py                   ← FastAPI entry point
│   ├── config.py                 ← Pydantic settings
│   ├── db/
│   │   ├── database.py           ← SQLAlchemy async engine
│   │   ├── models.py             ← ORM models
│   │   └── migrations.sql        ← Full schema + indexes + RRF function
│   ├── routers/
│   │   ├── chat.py               ← /chat/stream  (SSE)
│   │   ├── knowledge.py          ← /knowledge/upload|documents|sync
│   │   └── search.py             ← /search  (RRF hybrid)
│   ├── services/
│   │   ├── rag_service.py        ← Full RAG pipeline with RRF
│   │   ├── embedding_service.py  ← SentenceTransformer wrapper
│   │   └── storage_service.py    ← MinIO / S3 abstraction
│   └── requirements.txt
├── package.json                  ← Root (Electron + scripts)
└── .env.example
```

---

## Search: Reciprocal Rank Fusion (RRF)

The hybrid search merges semantic (pgvector cosine similarity) and keyword (PostgreSQL tsvector BM25-like) results:

```
RRF_score(d) = 1/(k + rank_semantic) + 1/(k + rank_keyword)
```

- `k = 60` (configurable via `RAG_RRF_K`)
- Documents appearing in both ranked lists score highest
- Handles vocabulary mismatch (semantic covers paraphrases; keyword covers exact terms)

---

## Building for Distribution

```bash
# Build frontend + package Electron
npm run dist
# Output: dist/ directory with platform-specific installer
```

---

## License

MIT
