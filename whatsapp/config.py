"""WhatsApp Cloud API configuration — loaded from env vars."""

from __future__ import annotations

import os

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
GRAPH_API_VERSION = os.environ.get("WHATSAPP_GRAPH_API_VERSION", "v21.0")

ENABLED = bool(ACCESS_TOKEN)

MAX_MESSAGE_LENGTH = 4096
