"""Thin LLM adapter — provider selection via env vars."""

from __future__ import annotations

import json
import logging
import os
import re
import base64
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=False)

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "").lower()
LLM_BASE_URL = os.environ.get("LLM_BASE_URL")
LLM_API_KEY = os.environ.get("LLM_API_KEY")

if not LLM_PROVIDER:
    if os.environ.get("DEEPSEEK_API_KEY"):
        LLM_PROVIDER = "deepseek"
    elif os.environ.get("ANTHROPIC_API_KEY"):
        LLM_PROVIDER = "anthropic"
    elif os.environ.get("OPENAI_API_KEY"):
        LLM_PROVIDER = "openai"
    elif os.environ.get("GOOGLE_API_KEY"):
        LLM_PROVIDER = "google"

_client = None
_client_cache: dict[tuple[str, str | None, str | None], object] = {}


@dataclass(frozen=True)
class LLMConfig:
    provider: str | None = None
    model: str | None = None
    base_url: str | None = None


def _normalize_config(config: LLMConfig | dict | None) -> LLMConfig:
    if config is None:
        return LLMConfig(provider=LLM_PROVIDER, base_url=LLM_BASE_URL)
    if isinstance(config, LLMConfig):
        return config
    return LLMConfig(
        provider=(config.get("provider") or config.get("llm_provider") or "").lower(),
        model=config.get("model") or config.get("llm_model"),
        base_url=config.get("base_url") or config.get("llm_base_url"),
    )


def _api_key_for_provider(provider: str) -> str | None:
    if provider == "deepseek":
        return LLM_API_KEY or os.environ.get("DEEPSEEK_API_KEY")
    if provider == "openai":
        return LLM_API_KEY or os.environ.get("OPENAI_API_KEY")
    if provider == "anthropic":
        return LLM_API_KEY or os.environ.get("ANTHROPIC_API_KEY")
    if provider == "google":
        return LLM_API_KEY or os.environ.get("GOOGLE_API_KEY")
    return LLM_API_KEY


def _base_url_for_provider(provider: str, configured: str | None) -> str | None:
    if configured:
        return configured
    if provider == "deepseek":
        return os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    if provider == "openai":
        return os.environ.get("OPENAI_BASE_URL") or LLM_BASE_URL
    return LLM_BASE_URL


def _get_client(config: LLMConfig | dict | None = None):
    global _client
    llm_config = _normalize_config(config)
    provider = (llm_config.provider or "").lower()
    base_url = _base_url_for_provider(provider, llm_config.base_url)
    api_key = _api_key_for_provider(provider)
    cache_key = (provider, base_url, api_key)

    if config is None and _client is not None:
        return _client
    if config is not None and cache_key in _client_cache:
        return _client_cache[cache_key]

    if provider == "anthropic":
        if not api_key:
            raise RuntimeError("Anthropic provider is configured but ANTHROPIC_API_KEY is not set.")
        try:
            import anthropic
        except ImportError:
            raise ImportError("pip install anthropic")
        client = anthropic.Anthropic(api_key=api_key)
    elif provider in {"openai", "deepseek"}:
        key_name = "DEEPSEEK_API_KEY" if provider == "deepseek" else "OPENAI_API_KEY"
        if not api_key:
            raise RuntimeError(f"{provider.title()} provider is configured but {key_name} is not set.")
        try:
            import openai
        except ImportError:
            raise ImportError("pip install openai")
        client = openai.OpenAI(api_key=api_key, base_url=base_url)
    elif provider == "google":
        if not api_key:
            raise RuntimeError("Google provider is configured but GOOGLE_API_KEY is not set.")
        try:
            from google import genai
        except ImportError:
            raise ImportError("pip install google-genai")
        client = genai.Client(api_key=api_key)
    else:
        raise RuntimeError(
            f"Unknown LLM_PROVIDER={provider!r}. "
            "Set LLM_PROVIDER to 'deepseek', 'anthropic', 'openai', or 'google', "
            "or set the corresponding API key env var for auto-detection."
        )
    if config is None:
        _client = client
    else:
        _client_cache[cache_key] = client
    return client


def _chat_anthropic(
    system: str,
    user_message: str,
    model: str,
    max_tokens: int,
    json_schema: dict | None,
    effort: str | None,
    cache_system: bool,
    config: LLMConfig | dict | None,
) -> str:
    client = _get_client(config)

    if cache_system:
        system_param = [
            {"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}
        ]
    else:
        system_param = system

    kwargs: dict = dict(
        model=model,
        max_tokens=max_tokens,
        system=system_param,
        messages=[{"role": "user", "content": user_message}],
    )

    if json_schema is not None:
        output_config: dict = {"format": {"type": "json_schema", "schema": json_schema}}
        if effort:
            output_config["effort"] = effort
        kwargs["output_config"] = output_config
    elif effort:
        kwargs["output_config"] = {"effort": effort}

    response = client.messages.create(**kwargs)
    return next((b.text for b in response.content if b.type == "text"), "")


def _chat_openai(
    system: str,
    user_message: str,
    model: str,
    max_tokens: int,
    json_schema: dict | None,
    config: LLMConfig | dict | None,
) -> str:
    client = _get_client(config)

    kwargs: dict = dict(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ],
    )

    if json_schema is not None:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "response", "strict": True, "schema": json_schema},
        }

    llm_config = _normalize_config(config)
    base_url = _base_url_for_provider((llm_config.provider or "").lower(), llm_config.base_url)
    logging.getLogger(__name__).info("calling model=%s provider=%s base_url=%s", model, llm_config.provider, base_url)
    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


def _gemini_schema(schema: dict) -> dict:
    """Convert JSON Schema to Gemini-compatible format:
    - Replace ["string","null"] union types with nullable:true
    - Remove additionalProperties (unsupported by Gemini)
    """
    schema = {k: v for k, v in schema.items() if k != "additionalProperties"}
    t = schema.get("type")
    if isinstance(t, list):
        non_null = [x for x in t if x != "null"]
        schema["type"] = non_null[0] if non_null else "string"
        schema["nullable"] = True
    if "properties" in schema:
        schema["properties"] = {
            k: _gemini_schema(v) if isinstance(v, dict) else v
            for k, v in schema["properties"].items()
        }
    if "items" in schema and isinstance(schema["items"], dict):
        schema["items"] = _gemini_schema(schema["items"])
    return schema


def _chat_google(
    system: str,
    user_message: str,
    model: str,
    max_tokens: int,
    json_schema: dict | None,
    config: LLMConfig | dict | None,
) -> str:
    from google.genai import types
    client = _get_client(config)

    config_kwargs: dict = dict(
        system_instruction=system,
        max_output_tokens=max_tokens,
    )
    if json_schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = _gemini_schema(json_schema)

    response = client.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(**config_kwargs),
        contents=user_message,
    )
    text = response.text or ""
    if json_schema is not None:
        return _extract_json_fallback(text)
    return text


def _extract_json_fallback(text: str) -> str:
    """Best-effort JSON extraction when structured output isn't available."""
    try:
        json.loads(text)
        return text
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            json.loads(match.group())
            return match.group()
        except json.JSONDecodeError:
            pass
    return text


def describe_image(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    model: str | None = None,
    max_tokens: int = 512,
    config: LLMConfig | dict | None = None,
) -> str:
    """Describe an uploaded technician photo using the configured vision model."""
    llm_config = _normalize_config(config)
    provider = (llm_config.provider or "").lower()
    model = model or os.environ.get("TECHNICIAN_AI_VISION_MODEL") or os.environ.get(
        "TECHNICIAN_AI_MODEL", llm_config.model or "gpt-4o"
    )
    model = llm_config.model or model

    if provider == "anthropic":
        client = _get_client(config)
        img_b64 = base64.b64encode(image_bytes).decode()
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": img_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return next((b.text for b in response.content if b.type == "text"), "").strip()
    elif provider == "openai":
        client = _get_client(config)
        img_b64 = base64.b64encode(image_bytes).decode()
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{img_b64}",
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return (response.choices[0].message.content or "").strip()
    elif provider == "google":
        from google.genai import types

        client = _get_client(config)
        response = client.models.generate_content(
            model=model,
            config=types.GenerateContentConfig(max_output_tokens=max_tokens),
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ],
        )
        return (response.text or "").strip()
    else:
        raise RuntimeError(
            "Photo questions require a vision-capable LLM provider/model. "
            f"Configured provider {provider!r} is not supported for photo Ask."
        )


def chat(
    system: str,
    user_message: str,
    model: str,
    max_tokens: int = 2048,
    json_schema: dict | None = None,
    effort: str | None = None,
    cache_system: bool = False,
    config: LLMConfig | dict | None = None,
) -> str:
    llm_config = _normalize_config(config)
    provider = (llm_config.provider or "").lower()
    model = llm_config.model or model

    if provider == "anthropic":
        return _chat_anthropic(
            system, user_message, model, max_tokens, json_schema, effort, cache_system, config
        )
    elif provider in {"openai", "deepseek"}:
        return _chat_openai(system, user_message, model, max_tokens, json_schema, config)
    elif provider == "google":
        return _chat_google(system, user_message, model, max_tokens, json_schema, config)
    else:
        raise RuntimeError(
            f"Unknown LLM_PROVIDER={provider!r}. "
            "Set LLM_PROVIDER to 'deepseek', 'anthropic', 'openai', or 'google', "
            "or set the corresponding API key env var."
        )
