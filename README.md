 # MeetMind AI – Meeting Intelligence Backend

MeetMind AI turns raw meeting transcripts into structured, searchable knowledge for remote teams, founders, PMs, sales, and agencies.

This project currently contains the **backend API** and **AI processing pipeline**.

## Tech Stack

- **Language**: Python 3.10+
- **Framework**: FastAPI
- **Database**: MongoDB (vector/semantic search can be layered on later)
- **AI Providers**: OpenAI / Claude (via environment-configurable client)
- **Container**: Docker (optional, via provided `Dockerfile`)

## High-Level Architecture

Transcript
→ Preprocessing (clean, normalize)
→ Chunking (token-safe segments)
→ Parallel LLM calls:
- Summarization
- Key point extraction
- Action item extraction
- Topic segmentation
- Sentiment analysis
→ Merge & validate against strict JSON schema
→ Persist to MongoDB (`meetings`, `insights`, embeddings)
→ Expose via FastAPI:
- `POST /analyze`
- `GET /meetings`
- `GET /meetings/{id}`
- `GET /search?q=...`

## Running Locally

### 1. Create and activate virtual environment

```bash
python -m venv .venv
source .venv/Scripts/activate  # on Windows PowerShell: .venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Create a `.env` file in the project root:

```bash
cp .env.example .env  # or create manually
```

Set at least:

- `MONGODB_URL=mongodb://localhost:27017`
- `MONGODB_DB_NAME=meetmind`
- `OPENAI_API_KEY=...` (or your preferred provider key)

### 4. Run the API

```bash
uvicorn app.main:app --reload
```

API will be available at `http://localhost:8000` with docs at `/docs`.

## API Overview

- `POST /analyze`
  - **Input**: raw transcript text (or file upload, in later iterations)
  - **Output**: structured JSON insights:
    - `summary`
    - `key_points`
    - `action_items`
    - `decisions`
    - `topics`
    - `sentiment`

- `GET /meetings`
  - List stored meetings (with basic metadata).

- `GET /meetings/{id}`
  - Get full analysis (raw transcript + insights).

- `GET /search?q=...`
  - Semantic + keyword search across meetings using `pgvector`.

## Project Structure

```text
app/
  main.py              # FastAPI app, routes wiring
  config.py            # Settings (env-based)
  db/
    base.py            # MongoDB client and database handle
    models.py          # Collection names and document builders
    init_db.py         # Placeholder (MongoDB creates collections on write)
  ai/
    pipeline.py        # Orchestration of full analysis
    prompts.py         # Master prompt & sub-prompts
    client.py          # LLM client abstraction
    schema.py          # Pydantic models / JSON schema validation
  routers/
    analyze.py         # POST /analyze
    meetings.py        # GET /meetings, /meetings/{id}
    search.py          # GET /search
```

## Next Steps / Roadmap

- Add file uploads (`.txt`, `.pdf`, `.docx`) to `/analyze`.
- Add authentication & multi-tenant support.
- Add frontend dashboard (Next.js / React) consuming this API.
- Add Slack / Notion integration for automatic summary delivery.
- Introduce proper migrations (Alembic) and observability (logging, tracing).

