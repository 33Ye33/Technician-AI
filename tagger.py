"""LLM-powered tagger for ingested content.

Option B: each chunk gets {topic_path, entry_type, title} attached to its
metadata. Option C will reuse this same shape inside atomic entries — see
entry_types.ATOMIC_ENTRY_FIELDS.
"""
import json
import os

import anthropic

import entry_types

MODEL = os.environ.get("TECHNICIAN_AI_MODEL", "claude-opus-4-7")

SYSTEM_PROMPT = """You classify chunks of technical documentation for a technician's knowledge base.

For each chunk, return:
- topic_path: 2-3 hierarchical labels, broad → narrow, lowercase snake_case (e.g. ["module_rework", "el_inspection"]).
- entry_type: exactly one of: {types}.
- title: short, ≤ 8 words, human-readable, captures the chunk's subject.

Strongly prefer reusing topic paths from the "existing topic paths" list when one fits the chunk. Only propose a new path when none of the existing ones apply. Keep the taxonomy small."""

SCHEMA = {
    "type": "object",
    "properties": {
        "topic_path": {"type": "array", "items": {"type": "string"}},
        "entry_type": {"type": "string", "enum": entry_types.ENTRY_TYPES},
        "title": {"type": "string"},
    },
    "required": ["topic_path", "entry_type", "title"],
    "additionalProperties": False,
}

_client: anthropic.Anthropic | None = None


def _anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def tag_content(
    text: str,
    source_label: str,
    existing_topics: list[list[str]] | None = None,
) -> dict:
    existing_block = ""
    if existing_topics:
        seen = set()
        sample: list[str] = []
        for tp in existing_topics:
            key = tuple(tp)
            if key in seen or not tp:
                continue
            seen.add(key)
            sample.append(" > ".join(tp))
            if len(sample) >= 50:
                break
        if sample:
            existing_block = "\n\nExisting topic paths:\n" + "\n".join(f"- {p}" for p in sample)

    user_message = f"Source: {source_label}{existing_block}\n\nChunk:\n{text}"

    response = _anthropic().messages.create(
        model=MODEL,
        max_tokens=512,
        system=SYSTEM_PROMPT.format(types=", ".join(entry_types.ENTRY_TYPES)),
        messages=[{"role": "user", "content": user_message}],
        output_config={
            "format": {"type": "json_schema", "schema": SCHEMA},
            "effort": "low",
        },
    )
    raw = next((b.text for b in response.content if b.type == "text"), "")
    result = json.loads(raw)
    # Defensive: clamp pathological outputs to a sane shape.
    path = [str(p).strip() for p in result.get("topic_path", []) if str(p).strip()][:4]
    if not path:
        path = ["unclassified"]
    return {
        "topic_path": path,
        "entry_type": result.get("entry_type") or "unknown",
        "title": (result.get("title") or "").strip()[:120] or "untitled",
    }
