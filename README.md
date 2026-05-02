# Technician AI

An open-source assistant for technicians doing construction and parts-assembly work. Answers questions from manufacturer manuals **and** captures the field-learned knowledge that never makes it into manuals — torque tricks, gotchas, "this part strips if you over-torque past 40Nm even though spec says 50."

The thesis: pure RAG over PDFs already exists. The thing that's actually valuable is the **capture loop** — making it near-zero-friction for a technician in the field to push what they just learned back into the knowledge base for the next person.

## Architecture (backbone)

```
Manuals (PDF) ──▶ ingest.py ──▶ chunks ──┐
                                         ├──▶ SQLite (sqlite-vec)
Technician feedback ──▶ structured ──────┘     (one polymorphic table)
                          knowledge entries

Question ──▶ embed ──▶ vec search ──▶ Claude (with cited sources) ──▶ answer
   ▲                                                                   │
   │                                                                   ▼
   └────── feedback ("Worked" / "Didn't work" / "I learned…") ─────────┘
                              ▼
                    new knowledge entry, embedded, retrievable next time
```

Stack: FastAPI + SQLite (`sqlite-vec`) + Anthropic (Claude Opus 4.7) + Voyage embeddings + HTMX (no frontend build step).

## Quickstart

### 1. Install

```bash
pip install -r requirements.txt
```

### 2. Configure keys

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY at minimum.
```

**`VOYAGE_API_KEY` is optional.**

- **With it set** → semantic search over chunks. Scales to thousands of pages.
- **Without it** → no embeddings; the system passes the most recent ~20 chunks to Claude verbatim every request. Fine for a quick demo with one or two short manuals; degrades past that.

Get a free Voyage key at https://www.voyageai.com/ when you're ready to scale beyond a single manual.

### 3. Ingest a manual

```bash
python ingest.py path/to/manual.pdf
```

You can pass multiple PDFs. They're chunked, embedded with `voyage-3-lite`, and stored in `data/tech.db`.

### 4. Run

```bash
python app.py
```

Open http://localhost:8000.

## The capture loop

After every answer the UI shows three buttons:

- **Worked** — confirmation logged.
- **Didn't work** — paired with a short note, the correction is structured by Claude into a knowledge entry and embedded into the same vector store the manuals live in. The next technician asking a similar question retrieves it.
- **I learned something** — same flow, used when the answer wasn't wrong but a tech wants to add context.

This is the thing worth focusing on. Pure retrieval is well-trodden; the moat is making contribution invisible.

## Files

| File | Purpose |
|---|---|
| `app.py` | FastAPI app, four routes (`/ask`, `/feedback/{id}`, `/ingest`, `/knowledge`). |
| `db.py` | SQLite schema, vector search, conversation log. |
| `rag.py` | Embeddings, retrieval, Claude calls (answering + structuring). |
| `ingest.py` | CLI to chunk + embed PDF manuals. |
| `templates/` | HTMX-rendered UI (one page + two partials). |

## Data model

One polymorphic table for everything searchable:

```
documents(id, kind ∈ {manual_chunk, knowledge_entry}, text, metadata_json, created_at)
doc_vecs(doc_id → embedding)   -- sqlite-vec virtual table
conversations(id, question, answer, retrieved_doc_ids_json, created_at)
```

Parts/equipment/etc. live in `metadata_json` until the schema needs to grow.

## Roadmap (deliberately not in v0)

- Auth, multi-tenancy
- Mobile-native app, voice/photo input
- A formal parts/equipment ontology
- Versioning and admin UI for knowledge curation

These all matter eventually. They don't matter for proving the loop works.

## License

MIT
