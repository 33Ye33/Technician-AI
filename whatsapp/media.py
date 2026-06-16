"""Download media files from WhatsApp Cloud API (two-step: get URL, then fetch binary)."""

from __future__ import annotations

import httpx

from whatsapp import config

_GRAPH_BASE = "https://graph.facebook.com"


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {config.ACCESS_TOKEN}"}


async def download_media(media_id: str) -> tuple[bytes, str, str]:
    """Download a media file by its WhatsApp media ID.

    Returns (file_bytes, mime_type, filename).
    """
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        meta = await client.get(
            f"{_GRAPH_BASE}/{config.GRAPH_API_VERSION}/{media_id}",
            headers=_headers(),
        )
        meta.raise_for_status()
        info = meta.json()

        data = await client.get(info["url"], headers=_headers())
        data.raise_for_status()

        return (
            data.content,
            info.get("mime_type", "application/octet-stream"),
            info.get("filename", ""),
        )
