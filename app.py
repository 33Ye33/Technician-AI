import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import db
import ingest
import rag

load_dotenv()

templates = Jinja2Templates(directory="templates")


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Technician AI", lifespan=lifespan)


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
