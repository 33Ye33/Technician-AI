"""Shared types for ingest extractors."""

from __future__ import annotations

PageResult = list[tuple[int, str]]
"""List of (page_number, extracted_text) tuples. 1-based numbering."""
