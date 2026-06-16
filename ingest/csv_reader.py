"""CSV text extraction."""

from __future__ import annotations

import csv
from pathlib import Path

from ingest.base import PageResult

MAX_ROWS = 5000


def extract(path: Path) -> PageResult:
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        return []

    headers = rows[0]
    data_rows = rows[1 : MAX_ROWS + 1]

    lines = [" | ".join(headers)]
    lines.append("-" * len(lines[0]))
    for row in data_rows:
        padded = row + [""] * (len(headers) - len(row))
        lines.append(" | ".join(padded[: len(headers)]))

    text = f"CSV: \"{path.name}\"\n" + "\n".join(lines)

    if len(rows) - 1 > MAX_ROWS:
        text += f"\n\n[Truncated: showing {MAX_ROWS} of {len(rows) - 1} rows]"

    return [(1, text)]
