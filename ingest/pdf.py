"""PDF text extraction."""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

from ingest.base import PageResult


def extract(path: Path) -> PageResult:
    reader = PdfReader(str(path))
    pages: PageResult = []
    for page_num, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((page_num, text))
    return pages
