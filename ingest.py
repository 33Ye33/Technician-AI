import sys
from pathlib import Path

from pptx import Presentation
from pypdf import PdfReader

import db
import rag

SUPPORTED_EXTS = {".pdf", ".pptx"}


def _extract_pdf_pages(pdf_path: Path) -> list[tuple[int, str]]:
    reader = PdfReader(str(pdf_path))
    pages: list[tuple[int, str]] = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((page_num, text))
    return pages


def _extract_pptx_slides(pptx_path: Path) -> list[tuple[int, str]]:
    prs = Presentation(str(pptx_path))
    slides: list[tuple[int, str]] = []
    for slide_num, slide in enumerate(prs.slides, start=1):
        parts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    line = "".join(run.text for run in para.runs).strip()
                    if line:
                        parts.append(line)
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame.text.strip()
            if notes:
                parts.append(f"[Speaker notes]\n{notes}")
        text = "\n".join(parts).strip()
        if text:
            slides.append((slide_num, text))
    return slides


def ingest_file(path: Path) -> int:
    if not path.exists():
        raise FileNotFoundError(path)
    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTS:
        raise ValueError(f"unsupported file type: {ext} (supported: {', '.join(sorted(SUPPORTED_EXTS))})")

    if ext == ".pdf":
        pages = _extract_pdf_pages(path)
        page_label = "page"
    else:
        pages = _extract_pptx_slides(path)
        page_label = "slide"

    title = path.stem
    rows: list[tuple[str, str, list[float] | None, dict]] = []

    page_chunks: list[tuple[int, str]] = []
    for page_num, page_text in pages:
        for chunk in rag.chunk_text(page_text):
            page_chunks.append((page_num, chunk))

    if not page_chunks:
        return 0

    if rag.EMBEDDINGS_ENABLED:
        BATCH = 64
        for i in range(0, len(page_chunks), BATCH):
            batch = page_chunks[i : i + BATCH]
            embeddings = rag.embed_texts([c for _, c in batch], input_type="document")
            for (page_num, chunk), embedding in zip(batch, embeddings):
                metadata = {"manual_title": title, page_label: page_num, "source_path": str(path)}
                rows.append(("manual_chunk", chunk, embedding, metadata))
    else:
        for page_num, chunk in page_chunks:
            metadata = {"manual_title": title, page_label: page_num, "source_path": str(path)}
            rows.append(("manual_chunk", chunk, None, metadata))

    db.init_db()
    inserted = db.insert_documents_batch(rows)
    return len(inserted)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python ingest.py <path/to/manual.{pdf,pptx}> [more ...]")
        sys.exit(1)

    db.init_db()
    total = 0
    for arg in sys.argv[1:]:
        path = Path(arg)
        print(f"Ingesting {path} ...")
        count = ingest_file(path)
        print(f"  -> {count} chunks")
        total += count
    print(f"Done. {total} chunks total.")


if __name__ == "__main__":
    main()
