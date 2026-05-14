"""Dispatch incoming WhatsApp messages to the appropriate Technician AI pipeline."""

from __future__ import annotations

import logging
import traceback
from pathlib import Path

import httpx

import db
import ingest
import rag
from whatsapp import config

log = logging.getLogger("whatsapp")

_GRAPH_BASE = "https://graph.facebook.com"

MIME_TO_EXT: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}

HELP_TEXT = (
    "*Technician AI — WhatsApp*\n\n"
    "Send me a message and I'll answer from ingested manuals.\n\n"
    "*Commands:*\n"
    "/ask <question> — ask a question\n"
    "/topics — list available topics\n"
    "/help — show this message\n\n"
    "*Upload a document* (PDF or PPTX) to ingest it.\n"
    "Add a caption like `/ask What is the torque spec?` to ingest and ask in one step."
)


async def send_reply(to: str, text: str) -> None:
    """Send one or more text messages (auto-split if over 4096 chars)."""
    chunks = _split_message(text)
    url = f"{_GRAPH_BASE}/{config.GRAPH_API_VERSION}/{config.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {config.ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
            payload = {
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": chunk},
            }
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()


def _split_message(text: str) -> list[str]:
    if len(text) <= config.MAX_MESSAGE_LENGTH:
        return [text]
    parts: list[str] = []
    while text:
        if len(text) <= config.MAX_MESSAGE_LENGTH:
            parts.append(text)
            break
        cut = text.rfind("\n", 0, config.MAX_MESSAGE_LENGTH)
        if cut <= 0:
            cut = config.MAX_MESSAGE_LENGTH
        parts.append(text[:cut])
        text = text[cut:].lstrip("\n")
    return parts


async def handle_message(message: dict) -> None:
    """Route a single incoming WhatsApp message."""
    sender = message.get("from", "")
    msg_type = message.get("type")

    log.info("message from=%s type=%s", sender, msg_type)

    try:
        if msg_type == "text":
            await _handle_text(sender, message["text"]["body"])
        elif msg_type == "document":
            caption = message["document"].get("caption", "")
            await _handle_document(sender, message["document"], caption)
        else:
            await send_reply(sender, f"Sorry, I can only handle text and document messages. You sent: {msg_type}")
    except Exception:
        log.exception("failed to handle message from=%s type=%s", sender, msg_type)
        await send_reply(sender, "Something went wrong processing your message. Please try again.")


async def _handle_text(sender: str, text: str) -> None:
    text = text.strip()
    if not text:
        return

    if text.lower() == "/help":
        await send_reply(sender, HELP_TEXT)
        return

    if text.lower() == "/topics":
        topics = db.list_topics()
        if not topics:
            await send_reply(sender, "No topics yet. Upload a manual to get started.")
            return
        lines = [f"- {t['path']} ({t['count']} chunks)" for t in topics]
        await send_reply(sender, "*Topics:*\n" + "\n".join(lines))
        return

    if text.lower().startswith("/ask "):
        text = text[5:].strip()

    if not text:
        await send_reply(sender, "Please include a question after /ask.")
        return

    result = rag.answer_question(text)
    answer = result["answer"]
    sources = result.get("sources", [])
    if sources:
        refs = "\n".join(
            f"[{s['index']}] {s['metadata'].get('manual_title', s['kind'])}"
            for s in sources[:3]
        )
        answer += f"\n\n_Sources:_\n{refs}"
    await send_reply(sender, answer)


async def _handle_document(sender: str, doc: dict, caption: str) -> None:
    from whatsapp.media import download_media

    mime = doc.get("mime_type", "")
    ext = MIME_TO_EXT.get(mime)
    if ext is None:
        log.warning("unsupported mime=%s from=%s", mime, sender)
        supported = ", ".join(sorted(ingest.SUPPORTED_EXTS))
        await send_reply(sender, f"Unsupported file type ({mime}). Supported: {supported}")
        return

    filename = doc.get("filename", f"upload{ext}")
    if not filename.endswith(ext):
        filename += ext

    log.info("document received: %s (%s) from=%s", filename, mime, sender)
    await send_reply(sender, f"Downloading and processing *{filename}*...")

    log.info("downloading media_id=%s", doc["id"])
    file_bytes, _, _ = await download_media(doc["id"])
    dest = Path("manuals") / filename
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file_bytes)
    log.info("saved %s (%d bytes)", dest, len(file_bytes))

    log.info("ingesting %s ...", filename)
    chunks = ingest.ingest_file(dest)
    log.info("ingested %s -> %d chunks", filename, chunks)

    question = ""
    if caption.strip().lower().startswith("/ask "):
        question = caption.strip()[5:].strip()

    if question:
        log.info("answering follow-up question: %s", question)
        result = rag.answer_question(question)
        await send_reply(
            sender,
            f"Ingested *{filename}* ({chunks} chunks).\n\n"
            f"*Q:* {question}\n\n{result['answer']}",
        )
    else:
        await send_reply(sender, f"Ingested *{filename}* ({chunks} chunks). You can now ask questions about it.")
