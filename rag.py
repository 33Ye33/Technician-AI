import json
import os
import re

import anthropic
import voyageai

import db
import tagger

EMBED_MODEL = "voyage-3-lite"
ANSWER_MODEL = os.environ.get("TECHNICIAN_AI_MODEL", "claude-opus-4-7")
TOP_K = 6
CHUNK_CHARS = 1800
CHUNK_OVERLAP = 200
NO_EMBED_MAX_DOCS = 20

EMBEDDINGS_ENABLED = bool(os.environ.get("VOYAGE_API_KEY"))

ANSWER_SYSTEM_PROMPT = """You are Technician AI, an assistant for technicians doing construction and parts-assembly work.

You answer questions using the provided source snippets. Two kinds of sources can appear:
- MANUAL: official manufacturer documentation.
- KNOWLEDGE: field-learned notes contributed by other technicians (often more practical than the manual, sometimes contradicting it).

Rules:
1. Ground every claim in the provided sources. Cite them inline as [#1], [#2], etc., matching the numbered snippets.
2. If the sources do not contain the answer, say so plainly. Do not guess.
3. When MANUAL and KNOWLEDGE conflict, surface both. Field knowledge often reflects real-world reality, but flag the conflict for the technician.
4. Be concise. Lead with the answer. Add the why or the steps only if it materially helps.
5. Never invent part numbers, torque specs, or measurements. If a precise value is needed and not in the sources, say so."""

STRUCTURE_SYSTEM_PROMPT = """You convert a technician's correction or new finding into a clean knowledge-base entry.

Output a compact entry with two fields: a canonical question (what someone would search for) and a self-contained answer (the field-learned fact, with any context needed to apply it). Strip filler. Preserve numbers, part references, and conditions exactly as the technician stated them."""

_voyage: voyageai.Client | None = None
_anthropic: anthropic.Anthropic | None = None


def _voyage_client() -> voyageai.Client:
    global _voyage
    if _voyage is None:
        _voyage = voyageai.Client()
    return _voyage


def _anthropic_client() -> anthropic.Anthropic:
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic()
    return _anthropic


def embed_texts(texts: list[str], input_type: str = "document") -> list[list[float]]:
    if not texts:
        return []
    if not EMBEDDINGS_ENABLED:
        raise RuntimeError("embed_texts called but VOYAGE_API_KEY is not set")
    result = _voyage_client().embed(texts, model=EMBED_MODEL, input_type=input_type)
    return result.embeddings


def embed_query(text: str) -> list[float]:
    return embed_texts([text], input_type="query")[0]


def chunk_text(text: str, max_chars: int = CHUNK_CHARS, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = re.sub(r"[ \t]+", " ", text).strip()
    if len(text) <= max_chars:
        return [text] if text else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        if end < len(text):
            split = text.rfind("\n", start, end)
            if split == -1 or split <= start + max_chars // 2:
                split = text.rfind(". ", start, end)
            if split != -1 and split > start + max_chars // 2:
                end = split + 1
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _format_sources(snippets: list[dict]) -> str:
    lines = []
    for i, s in enumerate(snippets, start=1):
        meta = s["metadata"]
        if s["kind"] == "manual_chunk":
            label = f"MANUAL — {meta.get('manual_title', 'unknown')}"
            if "page" in meta:
                label += f", p.{meta['page']}"
            elif "slide" in meta:
                label += f", slide {meta['slide']}"
        else:
            label = "KNOWLEDGE — field note"
            if meta.get("validated"):
                label += " (validated)"
        topic = meta.get("topic_path")
        entry_type = meta.get("entry_type")
        if topic:
            tag_bits = " > ".join(topic)
            if entry_type:
                tag_bits += f" / {entry_type}"
            label += f"  [{tag_bits}]"
        lines.append(f"[#{i}] {label}\n{s['text']}")
    return "\n\n".join(lines)


def answer_question(question: str) -> dict:
    if EMBEDDINGS_ENABLED:
        query_vec = embed_query(question)
        snippets = db.search_similar(query_vec, k=TOP_K)
    else:
        snippets = db.list_all_documents(limit=NO_EMBED_MAX_DOCS)

    if not snippets:
        answer = "I don't have any manuals or field notes ingested yet. Run `python ingest.py <pdf>` to load a manual."
        conv_id = db.insert_conversation(question, answer, [])
        return {"answer": answer, "sources": [], "conversation_id": conv_id}

    sources_block = _format_sources(snippets)
    user_message = f"Sources:\n\n{sources_block}\n\n---\n\nQuestion: {question}"

    response = _anthropic_client().messages.create(
        model=ANSWER_MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": ANSWER_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    answer = next((b.text for b in response.content if b.type == "text"), "")
    doc_ids = [s["id"] for s in snippets]
    conv_id = db.insert_conversation(question, answer, doc_ids)

    return {
        "answer": answer,
        "sources": [
            {
                "index": i + 1,
                "id": s["id"],
                "kind": s["kind"],
                "metadata": s["metadata"],
                "preview": s["text"][:200],
            }
            for i, s in enumerate(snippets)
        ],
        "conversation_id": conv_id,
    }


def structure_knowledge_entry(question: str, prior_answer: str, technician_note: str) -> dict:
    user_message = (
        f"Original question: {question}\n\n"
        f"AI's previous answer: {prior_answer}\n\n"
        f"Technician's correction or finding: {technician_note}\n\n"
        "Return JSON with two fields: 'question' (canonical search-style question) and 'answer' (the field-learned fact, self-contained)."
    )

    response = _anthropic_client().messages.create(
        model=ANSWER_MODEL,
        max_tokens=1024,
        system=STRUCTURE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        output_config={
            "format": {
                "type": "json_schema",
                "schema": {
                    "type": "object",
                    "properties": {
                        "question": {"type": "string"},
                        "answer": {"type": "string"},
                    },
                    "required": ["question", "answer"],
                    "additionalProperties": False,
                },
            }
        },
    )
    text = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(text)


def record_knowledge_from_feedback(
    conversation_id: int, kind: str, note: str | None
) -> dict | None:
    conv = db.get_conversation(conversation_id)
    if conv is None:
        return None

    if kind == "worked":
        return None

    if not note:
        return None

    structured = structure_knowledge_entry(conv["question"], conv["answer"], note)
    text = f"Q: {structured['question']}\nA: {structured['answer']}"
    embedding = (
        embed_texts([text], input_type="document")[0] if EMBEDDINGS_ENABLED else None
    )
    tags = tagger.tag_content(
        text,
        source_label="(field knowledge)",
        existing_topics=db.list_existing_topic_paths(),
    )
    metadata = {
        "question": structured["question"],
        "source_conversation_id": conversation_id,
        "origin": kind,
        "topic_path": tags["topic_path"],
        "entry_type": tags["entry_type"],
        "title": tags["title"],
    }
    doc_id = db.insert_document(
        kind="knowledge_entry",
        text=text,
        embedding=embedding,
        metadata=metadata,
    )
    return {"id": doc_id, **structured}
