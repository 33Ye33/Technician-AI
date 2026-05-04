<div align="center">

# Technician AI

## 🔧 Key Capabilities

### Multi-step Diagnosis
Instead of returning a single answer, the system guides users through a structured troubleshooting process:
- Identify surface-level issues
- Ask follow-up questions step by step
- Narrow down root causes
- Provide actionable repair guidance

### Improved Retrieval
- Combines semantic and keyword-based retrieval
- Handles exact parameter lookup (e.g. air pressure) more reliably

### Cost-efficient Design
- Standard queries avoid LLM usage where possible
- LLM is only used for reasoning-heavy Diagnose flows

**The open-source knowledge layer for people who fix, build, and assemble things for a living.**

Pulls answers from manufacturer manuals — and captures the field-learned tricks that never make it into them.

[![License: MIT](https://img.shields.io/badge/License-MIT-1a1a1a?style=flat-square)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Status](https://img.shields.io/badge/status-alpha-FF9F1C?style=flat-square)](#roadmap)
[![Powered by Claude](https://img.shields.io/badge/powered%20by-Claude%20Opus%204.7-D4A373?style=flat-square)](https://www.anthropic.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![HTMX](https://img.shields.io/badge/HTMX-3D72D7?style=flat-square&logo=htmx&logoColor=white)](https://htmx.org/)
[![Self-hosted](https://img.shields.io/badge/self--hosted-✓-2D9D78?style=flat-square)](#quickstart)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/AXora009/Technician-AI?style=social)](https://github.com/AXora009/Technician-AI)

[Quickstart](#quickstart) · [How it works](#how-it-works) · [Demo](#demo) · [Roadmap](#roadmap) · [Contributing](#contributing)

</div>

---

## The problem

In every factory, repair shop, and assembly line, the most valuable knowledge **isn't in the manual** — it's in the heads of the senior technicians.

- The torque trick that prevents a rework.
- The bolt that strips at 40Nm even though spec says 50.
- The vendor PDF that's plain wrong about the lubrication schedule.
- The "if you see this EL pattern, check the welding head before anything else" intuition built over a thousand units.

That knowledge walks out the door at 5pm, retires every year, and gets re-learned the hard way by every new hire.

## What Technician AI does

Two things, stitched into one tight loop:

| | |
|---|---|
| **`retrieve`** | Drop in PDFs and slide decks. Ask questions in plain English. Get answers with cited sources from the docs. |
| **`capture`** | Every answer is followed by three taps — **Worked / Didn't work / I learned…** Any correction or field note is structured by Claude into a searchable knowledge entry. The next person asking that question gets the manual answer **plus** the field note. |

Pure RAG over PDFs already exists everywhere. The capture loop is the moat.

---

## Demo

Drop a `.pptx` or `.pdf` into the system, ask a question, get a cited answer:

```
> What causes micro-cracks in module rework?

Micro-cracks are tied to four equipment areas [#7]:

  1. Tape machine        — incorrect tension or alignment
  2. Lamination nozzle   — uneven pressure across the panel
  3. Layout nozzle       — drop-height misconfiguration
  4. Barcode position    — interference with the cell during inspection
  5. Adhesive film       — length tolerance out of spec

Sources
  [#7] MANUAL — Module Rework Training PPT-EN, slide 7
  [#8] MANUAL — Module Rework Training PPT-EN, slide 8
  ...

[ Worked ]  [ Didn't work ]  [ I learned something ]
```

Tap **I learned something** with a quick note ("the layout nozzle drift only shows up after 4hrs of run-time, recalibrate at shift change") and that note becomes a structured knowledge entry retrievable on the next ask.

---

## Quickstart

Get from zero to a running instance in under five minutes.

### 1. Clone and install

```bash
git clone https://github.com/AXora009/Technician-AI.git
cd Technician-AI

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Open .env and set ANTHROPIC_API_KEY
# (VOYAGE_API_KEY is optional — see "Operating modes" below)
```

Get a Claude API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).

### 3. Ingest a manual

```bash
python ingest.py path/to/your-manual.pdf
# or
python ingest.py "path/to/training-deck.pptx"
```

Multiple files at once work too. Supported formats: `.pdf`, `.pptx`.

### 4. Run

```bash
python app.py
```

Open **http://localhost:8000**.

---

## How it works

```
                    ┌──────────────────────────────────────────┐
   .pdf / .pptx ──▶ │  ingest.py     chunk + embed + store     │
                    └─────────────────────┬────────────────────┘
                                          ▼
                            ┌───────────────────────────┐
                            │  SQLite (one polymorphic  │
                            │  table: manual_chunk +    │
                            │  knowledge_entry)         │
                            └────────────┬──────────────┘
                                         │
   "What's the torque spec?"             │
            │                            ▼
            ▼                  ┌─────────────────────┐
        embed query  ────────▶ │  cosine similarity  │
                               │  (numpy or vec DB)  │
                               └──────────┬──────────┘
                                          ▼ top-K snippets
                                   ┌─────────────┐
                                   │   Claude    │ ── cited answer
                                   └──────┬──────┘
                                          ▼
                          [ Worked ] [ Didn't ] [ I learned… ]
                                          │
                                          ▼
                          Claude structures the note into
                          { question, answer } → embed → insert
                          → retrievable on the next question
```

Manuals and field notes live in **one searchable surface**. The capture loop closes silently in the background.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| **LLM** | Claude Opus 4.7 (Anthropic) | Best-in-class reasoning, with citation-friendly outputs |
| **Embeddings** | Voyage `voyage-3-lite` *(optional)* | Lightweight, accurate, generous free tier |
| **Vector store** | SQLite + numpy cosine | Zero infra. Swap for pgvector or a vector DB when you outgrow it |
| **Backend** | FastAPI + Uvicorn | Async, typed, minimal |
| **Frontend** | HTMX + Jinja templates | No build step. No framework lock-in. Server-rendered, works on any phone |
| **Ingestion** | `pypdf` + `python-pptx` | Native PDF and PowerPoint extraction |

Total scaffold: **~500 lines of Python**, four files, zero infrastructure to provision.

---

## Operating modes

| | With `VOYAGE_API_KEY` | Without |
|---|---|---|
| **Retrieval** | Semantic vector search | Pass last ~20 chunks to Claude |
| **Scales to** | Thousands of pages | A few short manuals (demo / single-doc workflows) |
| **API keys needed** | Anthropic + Voyage | Anthropic only |

Recommended path: try without Voyage first to validate the loop, add Voyage when you ingest your second manual.

---

## Why this matters

Tribal knowledge has been a known problem in industry for decades. Every solution to date has had the same shape:
- A wiki nobody updates.
- A SharePoint folder nobody can find.
- A senior tech who answers the same question 200 times a year.
- A "lessons learned" doc collected after every incident, then never read again.

The reason these all fail is the same: **contribution friction**. If saving knowledge costs more than re-solving the problem, knowledge doesn't get saved.

Technician AI bets that LLMs finally close that gap. Three taps and one sentence is the contribution. Claude does the structuring, the embedding, the searching, the retrieval. The technician just answers the question they were going to answer anyway.

---

## What's explicitly *not* in v0

These all matter eventually. They don't matter for proving the loop works.

- Auth, multi-tenancy, RBAC
- Mobile-native app, voice/photo input
- Formal parts/equipment ontology
- Versioning and admin UI for knowledge curation
- Observability, analytics, billing
- A polished design system

Everything in v0 is in service of one question: **does the capture loop actually close?**

---

## Roadmap

**Backbone (✓ shipped)**
- Polymorphic SQLite store, cosine retrieval, optional embeddings
- Citation-grounded answers via Claude Opus 4.7
- PDF + PPTX ingestion
- Three-tap feedback → structured knowledge entry

**Next**
- Voice input on the answer page (mobile-first capture)
- Photo attachment on knowledge entries
- "Conflict surfaced" UI when manual and field note disagree
- Per-knowledge-entry validation count and decay
- pgvector backend for >100K chunks

**Beyond**
- Multi-tenant deployment story
- Native mobile (iOS / Android)
- Equipment / parts ontology
- Real-time collaboration on a single fix-in-progress

---

## Contributing

This is open source because the problem is bigger than any single team. PRs welcome on:

- New ingestion formats (`.docx`, `.html`, video transcripts)
- Alternative LLM/embedding providers (drop-in adapters)
- UI improvements (the v0 is intentionally bare; bring taste)
- Real-world test corpora and example datasets
- Documentation and translations

Open an issue first for anything bigger than a bug fix so we can align on direction.

---

## Acknowledgments

Built on the shoulders of giants — Anthropic Claude, Voyage AI, FastAPI, SQLite, HTMX, and the long lineage of people who figured out how to capture institutional knowledge before us.

---

## License

MIT — do whatever you want with it. If you ship something using this, drop a link in the issues. We'd love to see it.

---

<div align="center">

**If this resonates, star the repo — it's how the project grows.**

[![GitHub stars](https://img.shields.io/github/stars/AXora009/Technician-AI?style=for-the-badge&logo=github)](https://github.com/AXora009/Technician-AI/stargazers)

</div>
