"""FastAPI router for WhatsApp Cloud API webhook."""

from __future__ import annotations

import asyncio
import hashlib
import hmac
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Query, Request

from whatsapp import config
from whatsapp.handlers import handle_message

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/webhook")
async def verify(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == config.VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


def _verify_signature(payload: bytes, signature: str) -> bool:
    if not config.APP_SECRET or not signature:
        return not config.APP_SECRET
    try:
        scheme, sig = signature.split("=", 1)
    except ValueError:
        return False
    if scheme != "sha256":
        return False
    expected = hmac.new(
        config.APP_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected)


@router.post("/webhook")
async def receive(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    body = await request.body()
    if not _verify_signature(body, x_hub_signature_256 or ""):
        raise HTTPException(status_code=401, detail="Invalid signature")

    data = await request.json()
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for message in value.get("messages", []):
                asyncio.create_task(handle_message(message))

    return {"status": "ok"}
