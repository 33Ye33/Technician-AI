from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException

from . import database as db


VALID_ROLES = {"org_admin", "supervisor", "technician", "viewer"}
_jwk_client: PyJWKClient | None = None


@dataclass(frozen=True)
class CurrentTenant:
    user_id: str | None
    supabase_user_id: str
    email: str
    organization_id: str | None
    organization_name: str | None
    factory_id: str | None
    factory_name: str | None
    role: str


def auth_disabled_for_tests() -> bool:
    return os.environ.get("TECHNICIAN_AI_AUTH_DISABLED", "").lower() in {
        "1",
        "true",
        "yes",
    }


def _decode_supabase_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "")
    if alg and alg != "HS256":
        return _decode_supabase_token_with_jwks(token, alg)

    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_JWT_SECRET is not configured",
        )
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid authentication token")


def _decode_supabase_token_with_jwks(token: str, alg: str) -> dict:
    global _jwk_client
    supabase_url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    if not supabase_url:
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_URL is not configured",
        )
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        if _jwk_client is None:
            _jwk_client = PyJWKClient(jwks_url)
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience="authenticated",
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid authentication token")


def _tenant_from_context(context: dict, supabase_user_id: str) -> CurrentTenant:
    return CurrentTenant(
        user_id=context["user_id"],
        supabase_user_id=supabase_user_id,
        email=context["email"],
        organization_id=context["organization_id"],
        organization_name=context["organization_name"],
        factory_id=context["factory_id"],
        factory_name=context["factory_name"],
        role=context["role"],
    )


def get_current_tenant(
    authorization: Optional[str] = Header(None),
) -> CurrentTenant:
    if auth_disabled_for_tests():
        return CurrentTenant(
            user_id=None,
            supabase_user_id="test-supabase-user",
            email="test@example.com",
            organization_id=None,
            organization_name=None,
            factory_id=None,
            factory_name=None,
            role="org_admin",
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="authentication required")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_token(token)
    supabase_user_id = claims.get("sub")
    email = claims.get("email") or claims.get("user_metadata", {}).get("email")
    if not supabase_user_id:
        raise HTTPException(status_code=401, detail="invalid authentication token")

    context = db.get_user_context_by_supabase_id(supabase_user_id)
    if context is None:
        raise HTTPException(status_code=409, detail="factory workspace not created")
    return _tenant_from_context(context, supabase_user_id)


def require_writer(current: CurrentTenant = Depends(get_current_tenant)) -> CurrentTenant:
    if current.role not in {"org_admin", "supervisor", "technician"}:
        raise HTTPException(status_code=403, detail="insufficient role")
    return current


def bootstrap_workspace(
    *,
    authorization: Optional[str],
    organization_name: str,
    factory_name: str,
) -> CurrentTenant:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="authentication required")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_token(token)
    supabase_user_id = claims.get("sub")
    email = claims.get("email")
    if not supabase_user_id or not email:
        raise HTTPException(status_code=401, detail="invalid authentication token")
    try:
        context = db.create_signup_workspace(
            supabase_user_id=supabase_user_id,
            email=email,
            organization_name=organization_name,
            factory_name=factory_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _tenant_from_context(context, supabase_user_id)
