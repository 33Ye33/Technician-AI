import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

import db
import ingest
import rag
import whatsapp

_diag_sessions: dict[str, dict] = {}

load_dotenv()

templates = Jinja2Templates(directory="templates")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Technician AI", lifespan=lifespan)

if whatsapp.ENABLED:
    app.include_router(whatsapp.router)
    log.info("whatsapp webhook enabled at /whatsapp/webhook")
else:
    log.info("whatsapp disabled — set WHATSAPP_ACCESS_TOKEN to enable")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    entries = db.list_knowledge_entries(limit=20)
    topics = db.list_topics(include_documents=True)
    return templates.TemplateResponse(
        request,
        "index.html",
        {"knowledge_entries": entries, "topics": topics},
    )


@app.post("/ask", response_class=HTMLResponse)
def ask(request: Request, question: str = Form(...)):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="empty question")
    result = rag.answer_question(question)
    return templates.TemplateResponse(request, "_answer.html", result)


@app.post("/feedback/{conversation_id}", response_class=HTMLResponse)
def feedback(
    request: Request,
    conversation_id: int,
    kind: str = Form(...),
    note: Optional[str] = Form(None),
):
    if kind not in ("worked", "failed", "learned"):
        raise HTTPException(status_code=400, detail="invalid kind")

    if kind == "worked":
        return HTMLResponse(
            '<div class="msg ok">Marked as worked. Thanks!</div>'
        )

    note = (note or "").strip()
    if not note:
        return HTMLResponse(
            '<div class="msg warn">Add a note describing what you learned, then submit again.</div>'
        )

    entry = rag.record_knowledge_from_feedback(conversation_id, kind, note)
    if entry is None:
        raise HTTPException(status_code=404, detail="conversation not found")

    return templates.TemplateResponse(request, "_entry_added.html", {"entry": entry})


@app.post("/ingest")
async def ingest_endpoint(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ingest.SUPPORTED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported file type {ext} (supported: {', '.join(sorted(ingest.SUPPORTED_EXTS))})",
        )
    dest = Path("manuals") / file.filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(await file.read())
    chunks = ingest.ingest_file(dest)
    return JSONResponse({"filename": file.filename, "chunks": chunks})


@app.get("/knowledge")
def knowledge():
    return {"entries": db.list_knowledge_entries(limit=200)}


@app.get("/topics")
def topics():
    return {"topics": db.list_topics()}


# --- JSON API for React SPA ---

@app.post("/api/ask")
def api_ask(question: str = Form(...)):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="empty question")
    return rag.answer_question(question)


@app.post("/api/feedback/{conversation_id}")
def api_feedback(
    conversation_id: int,
    kind: str = Form(...),
    note: Optional[str] = Form(None),
):
    if kind not in ("worked", "failed", "learned"):
        raise HTTPException(status_code=400, detail="invalid kind")
    if kind == "worked":
        return {"message": "Marked as worked. Thanks!"}
    note = (note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="note required for failed/learned")
    entry = rag.record_knowledge_from_feedback(conversation_id, kind, note)
    if entry is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return entry


@app.post("/api/ingest")
async def api_ingest(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ingest.SUPPORTED_EXTS:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported file type {ext}",
        )
    dest = Path("manuals") / file.filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(await file.read())
    chunks = ingest.ingest_file(dest)
    return {"filename": file.filename, "chunks": chunks}


@app.get("/api/knowledge")
def api_knowledge():
    return {"entries": db.list_knowledge_entries(limit=200)}


@app.get("/api/topics")
def api_topics():
    return {"topics": db.list_topics()}


@app.post("/api/diagnose")
def api_diagnose_start(question: str = Form(...)):
    question = question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="empty question")
    session_id = str(uuid.uuid4())
    result = rag.diagnose_step(question, history=[], questions_asked=0)
    _diag_sessions[session_id] = {
        "question": question,
        "history": [{"role": "assistant", "content": result["message"]}],
    }
    return {**result, "session_id": session_id, "step": 1}


@app.post("/api/diagnose/step")
def api_diagnose_continue(
    session_id: str = Form(...),
    answer: str = Form(...),
):
    answer = answer.strip()
    if not answer:
        raise HTTPException(status_code=400, detail="empty answer")
    session = _diag_sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=400, detail="session not found")
    question = session["question"]
    history = list(session["history"])
    questions_asked = sum(1 for m in history if m["role"] == "assistant")
    history.append({"role": "user", "content": answer})
    result = rag.diagnose_step(question, history, questions_asked=questions_asked)
    if not result["is_resolved"]:
        history.append({"role": "assistant", "content": result["message"]})
    session["history"] = history
    step = sum(1 for m in session["history"] if m["role"] == "assistant")
    return {**result, "session_id": session_id, "step": step}


# --- SPA static serving ---

_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="spa-assets")

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        file = _static_dir / path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(_static_dir / "index.html")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)
