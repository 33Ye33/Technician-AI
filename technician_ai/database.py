from __future__ import annotations

import json
import os
import re
import sqlite3
import struct
import uuid
from pathlib import Path

import numpy as np

EMBED_DIM = int(os.environ.get("EMBED_DIM", "512"))
DB_PATH = os.environ.get("TECHNICIAN_AI_DB", "./data/tech.db")
VALID_LLM_PROVIDERS = {"deepseek", "openai", "google", "anthropic"}


def _pack(vec: list[float] | None) -> bytes | None:
    if vec is None:
        return None
    return struct.pack(f"{len(vec)}f", *vec)


def _unpack(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


def connect() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = connect()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS factories (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                name TEXT NOT NULL,
                llm_provider TEXT,
                llm_model TEXT,
                llm_base_url TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                supabase_user_id TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS memberships (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                organization_id TEXT NOT NULL,
                factory_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('org_admin', 'supervisor', 'technician', 'viewer')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, factory_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (organization_id) REFERENCES organizations(id),
                FOREIGN KEY (factory_id) REFERENCES factories(id)
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                text TEXT NOT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                embedding BLOB,
                organization_id TEXT,
                factory_id TEXT,
                uploaded_by_user_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                retrieved_doc_ids_json TEXT NOT NULL DEFAULT '[]',
                status TEXT,
                organization_id TEXT,
                factory_id TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS diagnose_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                machine TEXT,
                question TEXT NOT NULL,
                history_json TEXT NOT NULL DEFAULT '[]',
                retrieved_doc_ids_json TEXT NOT NULL DEFAULT '[]',
                final_resolution TEXT,
                confidence TEXT,
                rating INTEGER,
                feedback_comment TEXT,
                is_resolved INTEGER NOT NULL DEFAULT 0,
                organization_id TEXT,
                factory_id TEXT,
                user_id TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS uploaded_files (
                id TEXT PRIMARY KEY,
                organization_id TEXT NOT NULL,
                factory_id TEXT NOT NULL,
                uploaded_by_user_id TEXT,
                original_filename TEXT NOT NULL,
                local_path TEXT NOT NULL,
                content_type TEXT,
                size_bytes INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        # Migrate existing installs: add new columns if missing
        for col, definition in [
            ("rating", "INTEGER"),
            ("feedback_comment", "TEXT"),
        ]:
            try:
                conn.execute(f"ALTER TABLE diagnose_sessions ADD COLUMN {col} {definition}")
            except Exception:
                pass
            try:
                conn.execute(f"ALTER TABLE conversations ADD COLUMN {col} {definition}")
            except Exception:
                pass
        conn.commit()

        _ensure_columns(
            conn,
            "factories",
            [
                ("llm_provider", "TEXT"),
                ("llm_model", "TEXT"),
                ("llm_base_url", "TEXT"),
            ],
        )
        _ensure_columns(
            conn,
            "documents",
            [
                ("organization_id", "TEXT"),
                ("factory_id", "TEXT"),
                ("uploaded_by_user_id", "TEXT"),
            ],
        )
        _ensure_columns(
            conn,
            "conversations",
            [
                ("status", "TEXT"),
                ("feedback_note", "TEXT"),
                ("rating", "INTEGER"),
                ("feedback_comment", "TEXT"),
                ("organization_id", "TEXT"),
                ("factory_id", "TEXT"),
                ("user_id", "TEXT"),
            ],
        )
        _ensure_columns(
            conn,
            "diagnose_sessions",
            [
                ("rating", "INTEGER"),
                ("feedback_comment", "TEXT"),
                ("organization_id", "TEXT"),
                ("factory_id", "TEXT"),
                ("user_id", "TEXT"),
            ],
        )
        conn.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_documents_factory_kind ON documents(factory_id, kind);
            CREATE INDEX IF NOT EXISTS idx_conversations_factory_created ON conversations(factory_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_diagnose_sessions_factory_updated ON diagnose_sessions(factory_id, updated_at);
            CREATE INDEX IF NOT EXISTS idx_uploaded_files_factory_created ON uploaded_files(factory_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
            CREATE INDEX IF NOT EXISTS idx_users_supabase ON users(supabase_user_id);
            """
        )
        conn.commit()
    finally:
        conn.close()


def _ensure_columns(conn: sqlite3.Connection, table: str, columns: list[tuple[str, str]]) -> None:
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    for name, definition in columns:
        if name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
    conn.commit()


def default_llm_settings() -> dict:
    """Return the default provider/model for a new or unconfigured factory."""
    provider = (os.environ.get("LLM_PROVIDER") or "").strip().lower()
    if not provider:
        if os.environ.get("DEEPSEEK_API_KEY"):
            provider = "deepseek"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        elif os.environ.get("GOOGLE_API_KEY"):
            provider = "google"
    if provider not in VALID_LLM_PROVIDERS:
        provider = "openai"

    model_by_provider = {
        "deepseek": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        "openai": os.environ.get("OPENAI_MODEL") or os.environ.get("TECHNICIAN_AI_MODEL", "gpt-4o-mini"),
        "google": os.environ.get("GOOGLE_MODEL") or os.environ.get("TECHNICIAN_AI_MODEL", "gemini-2.0-flash"),
        "anthropic": os.environ.get("ANTHROPIC_MODEL") or os.environ.get("TECHNICIAN_AI_MODEL", "claude-opus-4-7"),
    }
    base_url_by_provider = {
        "deepseek": os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        "openai": os.environ.get("OPENAI_BASE_URL") or os.environ.get("LLM_BASE_URL"),
        "google": None,
        "anthropic": None,
    }
    return {
        "llm_provider": provider or None,
        "llm_model": model_by_provider.get(provider),
        "llm_base_url": base_url_by_provider.get(provider),
    }


def create_signup_workspace(
    *,
    supabase_user_id: str,
    email: str,
    organization_name: str,
    factory_name: str,
) -> dict:
    """Create the first org/factory membership for a Supabase user."""
    init_db()
    organization_name = organization_name.strip()
    factory_name = factory_name.strip()
    email = email.strip().lower()
    if not organization_name or not factory_name:
        raise ValueError("organization and factory names are required")

    conn = connect()
    try:
        existing = conn.execute(
            """
            SELECT u.id AS user_id, u.email, m.organization_id, m.factory_id, m.role,
                   o.name AS organization_name, f.name AS factory_name
            FROM users u
            JOIN memberships m ON m.user_id = u.id
            JOIN organizations o ON o.id = m.organization_id
            JOIN factories f ON f.id = m.factory_id
            WHERE u.supabase_user_id = ?
            ORDER BY m.created_at ASC
            LIMIT 1
            """,
            (supabase_user_id,),
        ).fetchone()
        if existing:
            return _context_from_row(existing)

        user_id = str(uuid.uuid4())
        organization_id = str(uuid.uuid4())
        factory_id = str(uuid.uuid4())
        membership_id = str(uuid.uuid4())
        llm_defaults = default_llm_settings()
        conn.execute(
            "INSERT INTO organizations (id, name) VALUES (?, ?)",
            (organization_id, organization_name),
        )
        conn.execute(
            """
            INSERT INTO factories
                (id, organization_id, name, llm_provider, llm_model, llm_base_url)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                factory_id,
                organization_id,
                factory_name,
                llm_defaults["llm_provider"],
                llm_defaults["llm_model"],
                llm_defaults["llm_base_url"],
            ),
        )
        conn.execute(
            "INSERT INTO users (id, supabase_user_id, email) VALUES (?, ?, ?)",
            (user_id, supabase_user_id, email),
        )
        conn.execute(
            """
            INSERT INTO memberships (id, user_id, organization_id, factory_id, role)
            VALUES (?, ?, ?, ?, ?)
            """,
            (membership_id, user_id, organization_id, factory_id, "org_admin"),
        )
        conn.commit()
        return {
            "user_id": user_id,
            "email": email,
            "organization_id": organization_id,
            "organization_name": organization_name,
            "factory_id": factory_id,
            "factory_name": factory_name,
            "role": "org_admin",
        }
    finally:
        conn.close()


def get_user_context_by_supabase_id(supabase_user_id: str) -> dict | None:
    init_db()
    conn = connect()
    try:
        row = conn.execute(
            """
            SELECT u.id AS user_id, u.email, m.organization_id, m.factory_id, m.role,
                   o.name AS organization_name, f.name AS factory_name
            FROM users u
            JOIN memberships m ON m.user_id = u.id
            JOIN organizations o ON o.id = m.organization_id
            JOIN factories f ON f.id = m.factory_id
            WHERE u.supabase_user_id = ?
            ORDER BY m.created_at ASC
            LIMIT 1
            """,
            (supabase_user_id,),
        ).fetchone()
        return _context_from_row(row) if row else None
    finally:
        conn.close()


def _context_from_row(row) -> dict:
    return {
        "user_id": row["user_id"],
        "email": row["email"],
        "organization_id": row["organization_id"],
        "organization_name": row["organization_name"],
        "factory_id": row["factory_id"],
        "factory_name": row["factory_name"],
        "role": row["role"],
    }


def get_factory_llm_settings(factory_id: str | None) -> dict:
    defaults = default_llm_settings()
    if not factory_id:
        return defaults
    init_db()
    conn = connect()
    try:
        row = conn.execute(
            """
            SELECT llm_provider, llm_model, llm_base_url
            FROM factories
            WHERE id = ?
            """,
            (factory_id,),
        ).fetchone()
    finally:
        conn.close()
    if row is None:
        return defaults
    provider = (row["llm_provider"] or defaults["llm_provider"] or "").strip().lower()
    if provider not in VALID_LLM_PROVIDERS:
        provider = defaults["llm_provider"]
    return {
        "llm_provider": provider,
        "llm_model": (row["llm_model"] or defaults["llm_model"] or "").strip() or None,
        "llm_base_url": (row["llm_base_url"] or defaults["llm_base_url"] or "").strip() or None,
    }


def update_factory_llm_settings(
    *,
    factory_id: str,
    provider: str,
    model: str,
    base_url: str | None = None,
) -> dict:
    provider = provider.strip().lower()
    model = model.strip()
    base_url = (base_url or "").strip() or None
    if provider not in VALID_LLM_PROVIDERS:
        raise ValueError("invalid LLM provider")
    if not model:
        raise ValueError("model name is required")
    conn = connect()
    try:
        cur = conn.execute(
            """
            UPDATE factories
            SET llm_provider = ?, llm_model = ?, llm_base_url = ?
            WHERE id = ?
            """,
            (provider, model, base_url, factory_id),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise LookupError("factory not found")
    finally:
        conn.close()
    return get_factory_llm_settings(factory_id)


def insert_document(
    kind: str,
    text: str,
    embedding: list[float] | None,
    metadata: dict | None = None,
    organization_id: str | None = None,
    factory_id: str | None = None,
    uploaded_by_user_id: str | None = None,
) -> int:
    conn = connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO documents
                (kind, text, metadata_json, embedding, organization_id, factory_id, uploaded_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                kind,
                text,
                json.dumps(metadata or {}),
                _pack(embedding),
                organization_id,
                factory_id,
                uploaded_by_user_id,
            ),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def insert_documents_batch(
    rows: list[tuple[str, str, list[float] | None, dict]],
    organization_id: str | None = None,
    factory_id: str | None = None,
    uploaded_by_user_id: str | None = None,
) -> list[int]:
    if not rows:
        return []
    conn = connect()
    try:
        ids: list[int] = []
        for kind, text, embedding, metadata in rows:
            cur = conn.execute(
                """
                INSERT INTO documents
                    (kind, text, metadata_json, embedding, organization_id, factory_id, uploaded_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    kind,
                    text,
                    json.dumps(metadata or {}),
                    _pack(embedding),
                    organization_id,
                    factory_id,
                    uploaded_by_user_id,
                ),
            )
            ids.append(cur.lastrowid)
        conn.commit()
        return ids
    finally:
        conn.close()


def _factory_where(factory_id: str | None) -> tuple[str, tuple]:
    return (" WHERE factory_id = ?", (factory_id,)) if factory_id else ("", ())


def search_similar(embedding: list[float], k: int = 6, factory_id: str | None = None) -> list[dict]:
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"SELECT id, kind, text, metadata_json, embedding FROM documents{where}"
            + (" AND embedding IS NOT NULL" if where else " WHERE embedding IS NOT NULL"),
            params,
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return []

    query = np.asarray(embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query)
    if query_norm == 0:
        return []
    query = query / query_norm

    scored = []
    for r in rows:
        vec = _unpack(r["embedding"])
        norm = np.linalg.norm(vec)
        if norm == 0:
            continue
        sim = float(np.dot(query, vec / norm))
        scored.append((sim, r))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "id": r["id"],
            "kind": r["kind"],
            "text": r["text"],
            "metadata": json.loads(r["metadata_json"]),
            "score": sim,
        }
        for sim, r in scored[:k]
    ]


def list_all_documents(limit: int = 20, factory_id: str | None = None) -> list[dict]:
    """Used in no-embeddings mode: return the most recent docs as 'all sources'."""
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"SELECT id, kind, text, metadata_json FROM documents{where} ORDER BY id DESC LIMIT ?",
            (*params, limit),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "kind": r["kind"],
                "text": r["text"],
                "metadata": json.loads(r["metadata_json"]),
                "score": None,
            }
            for r in rows
        ]
    finally:
        conn.close()


# Maps phrases a technician might say → substrings that must appear in manual_title.
# Checked case-insensitively against the query. First match wins.
_MACHINE_TITLE_FILTERS: list[tuple[tuple[str, ...], tuple[str, ...]]] = [
    (("glass loading",),                          ("glass loading",)),
    (("edge trimming",),                          ("edge trimming",)),
    (("corner wrapping",),                        ("corner wrapping",)),
    (("busbar tab lifting", "busbar lifting", "tab lifting", "busbar leads lifting"),
                                                  ("busbar tab lifting", "ILM-T-PostLam-WI-54068")),
    (("busbar soldering",),                       ("busbar soldering",)),
    (("all in one soldering", "all-in-one soldering", "soldering stringer", "04_01"),
                                                  ("all in one soldering", "04_01")),
    (("junction box soldering",),                 ("junction box soldering",)),
]


def _detect_manual_filter(query: str) -> tuple[str, ...] | None:
    """Return title substrings to filter on if a machine name is found in the query."""
    q = query.lower()
    for phrases, title_substrings in _MACHINE_TITLE_FILTERS:
        if any(p in q for p in phrases):
            return title_substrings
    return None


def search_by_keywords(query: str, k: int = 6, factory_id: str | None = None) -> list[dict]:
    """Keyword-based fallback retrieval when embeddings are disabled.

    Scores each document by how many unique query terms appear in its text,
    then returns the top-k by score. Falls back to most-recent if no matches.

    When the query mentions a specific machine name, retrieval is first scoped
    to that machine's manual chunks to avoid cross-manual contamination.
    """
    _STOPWORDS = {
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "to", "of", "in", "for",
        "on", "with", "at", "by", "from", "and", "or", "but", "not", "this",
        "that", "it", "its", "what", "which", "who", "how", "when", "where",
        "i", "my", "we", "our", "you", "your", "they", "their",
    }
    words = [w.lower() for w in re.split(r"\W+", query) if len(w) > 2 and w.lower() not in _STOPWORDS]
    if not words:
        return list_all_documents(limit=k, factory_id=factory_id)

    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"SELECT id, kind, text, metadata_json FROM documents{where}",
            params,
        ).fetchall()
    finally:
        conn.close()

    # Scope to a specific machine's manual when the query names one.
    title_filter = _detect_manual_filter(query)
    if title_filter:
        scoped = []
        for r in rows:
            meta = json.loads(r["metadata_json"])
            title = meta.get("manual_title", "").lower()
            if any(f in title for f in title_filter) or r["kind"] != "manual_chunk":
                scoped.append(r)
        # Only use scoped rows if they contain actual content; otherwise fall back.
        if scoped:
            rows = scoped

    scored = []
    for r in rows:
        text_lower = r["text"].lower()
        score = sum(1 for w in words if w in text_lower)
        if score > 0:
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        return list_all_documents(limit=k, factory_id=factory_id)

    return [
        {
            "id": r["id"],
            "kind": r["kind"],
            "text": r["text"],
            "metadata": json.loads(r["metadata_json"]),
            "score": score,
        }
        for score, r in scored[:k]
    ]


def insert_conversation(
    question: str,
    answer: str,
    retrieved_doc_ids: list[int],
    organization_id: str | None = None,
    factory_id: str | None = None,
    user_id: str | None = None,
) -> int:
    conn = connect()
    try:
        cur = conn.execute(
            """
            INSERT INTO conversations
                (question, answer, retrieved_doc_ids_json, organization_id, factory_id, user_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (question, answer, json.dumps(retrieved_doc_ids), organization_id, factory_id, user_id),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def update_conversation_status(conversation_id: int, status: str, factory_id: str | None = None) -> None:
    conn = connect()
    try:
        if factory_id:
            conn.execute(
                "UPDATE conversations SET status = ? WHERE id = ? AND factory_id = ?",
                (status, conversation_id, factory_id),
            )
        else:
            conn.execute(
                "UPDATE conversations SET status = ? WHERE id = ?",
                (status, conversation_id),
            )
        conn.commit()
    finally:
        conn.close()


def update_conversation_feedback_note(
    conversation_id: int, note: str | None, factory_id: str | None = None
) -> None:
    conn = connect()
    try:
        if factory_id:
            conn.execute(
                "UPDATE conversations SET feedback_note = ? WHERE id = ? AND factory_id = ?",
                (note, conversation_id, factory_id),
            )
        else:
            conn.execute(
                "UPDATE conversations SET feedback_note = ? WHERE id = ?",
                (note, conversation_id),
            )
        conn.commit()
    finally:
        conn.close()


def list_conversations(limit: int = 100, factory_id: str | None = None) -> list[dict]:
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"""SELECT id, question, answer, rating, feedback_comment, created_at
               FROM conversations{where} ORDER BY created_at DESC LIMIT ?""",
            (*params, limit),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "question": r["question"],
                "answer": r["answer"],
                "rating": r["rating"],
                "feedback_comment": r["feedback_comment"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_conversation(conversation_id: int, factory_id: str | None = None) -> dict | None:
    conn = connect()
    try:
        if factory_id:
            row = conn.execute(
                """
                SELECT id, question, answer, retrieved_doc_ids_json, status, feedback_note,
                       organization_id, factory_id, user_id
                FROM conversations WHERE id = ? AND factory_id = ?
                """,
                (conversation_id, factory_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT id, question, answer, retrieved_doc_ids_json, status, feedback_note,
                       organization_id, factory_id, user_id
                FROM conversations WHERE id = ?
                """,
                (conversation_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "question": row["question"],
            "answer": row["answer"],
            "retrieved_doc_ids": json.loads(row["retrieved_doc_ids_json"]),
            "status": row["status"],
            "feedback_note": row["feedback_note"],
            "organization_id": row["organization_id"],
            "factory_id": row["factory_id"],
            "user_id": row["user_id"],
        }
    finally:
        conn.close()


def update_conversation_rating(
    conversation_id: int,
    rating: int,
    comment: str | None = None,
    factory_id: str | None = None,
) -> bool:
    conn = connect()
    try:
        if factory_id:
            cur = conn.execute(
                "UPDATE conversations SET rating = ?, feedback_comment = ? WHERE id = ? AND factory_id = ?",
                (rating, comment, conversation_id, factory_id),
            )
        else:
            cur = conn.execute(
                "UPDATE conversations SET rating = ?, feedback_comment = ? WHERE id = ?",
                (rating, comment, conversation_id),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def list_topics(include_documents: bool = False, factory_id: str | None = None) -> list[dict]:
    """Distinct topic paths with per-kind counts. Powers the topic browser.

    With include_documents=True, each topic carries its full document list so
    the UI can render an expandable tree.
    """
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"SELECT id, kind, text, metadata_json, created_at FROM documents{where} ORDER BY id",
            params,
        ).fetchall()
    finally:
        conn.close()

    buckets: dict[tuple, dict] = {}
    for r in rows:
        meta = json.loads(r["metadata_json"])
        path = meta.get("topic_path")
        if not path:
            continue
        key = tuple(path)
        bucket = buckets.setdefault(
            key,
            {
                "path": list(path),
                "manual_count": 0,
                "knowledge_count": 0,
                "documents": [],
            },
        )
        if r["kind"] == "manual_chunk":
            bucket["manual_count"] += 1
        elif r["kind"] == "knowledge_entry":
            bucket["knowledge_count"] += 1

        if include_documents:
            bucket["documents"].append(
                {
                    "id": r["id"],
                    "kind": r["kind"],
                    "text": r["text"],
                    "metadata": meta,
                    "created_at": r["created_at"],
                }
            )

    out = sorted(buckets.values(), key=lambda x: " > ".join(x["path"]))
    if not include_documents:
        for b in out:
            del b["documents"]
    return out


def list_existing_topic_paths(limit: int = 2000, factory_id: str | None = None) -> list[list[str]]:
    """All distinct topic paths in the DB, for tagger consistency."""
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"SELECT metadata_json FROM documents{where} LIMIT ?",
            (*params, limit),
        ).fetchall()
    finally:
        conn.close()
    seen: set[tuple] = set()
    out: list[list[str]] = []
    for r in rows:
        meta = json.loads(r["metadata_json"])
        tp = meta.get("topic_path")
        if not tp:
            continue
        key = tuple(tp)
        if key not in seen:
            seen.add(key)
            out.append(tp)
    return out


def list_manuals(factory_id: str | None = None) -> list[dict]:
    """Return distinct manuals with chunk count and source path."""
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        clause = f" AND factory_id = ?" if factory_id else ""
        rows = conn.execute(
            f"SELECT metadata_json FROM documents WHERE kind = 'manual_chunk'{clause}",
            params,
        ).fetchall()
    finally:
        conn.close()
    seen: dict[str, dict] = {}
    for r in rows:
        meta = json.loads(r["metadata_json"])
        title = meta.get("manual_title", "")
        if not title:
            continue
        if title not in seen:
            seen[title] = {"title": title, "chunks": 0, "source_path": meta.get("source_path", "")}
        seen[title]["chunks"] += 1
    return list(seen.values())


def delete_manual(title: str, factory_id: str | None = None) -> int:
    """Delete all chunks for a manual. Returns number of rows deleted."""
    conn = connect()
    try:
        if factory_id:
            rows = conn.execute(
                "SELECT id FROM documents WHERE metadata_json LIKE ? AND factory_id = ?",
                (f'%"manual_title": "{title}"%', factory_id),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id FROM documents WHERE metadata_json LIKE ?",
                (f'%"manual_title": "{title}"%',)
            ).fetchall()
        ids = [r["id"] for r in rows]
        if ids:
            conn.execute(
                f"DELETE FROM documents WHERE id IN ({','.join('?' for _ in ids)})", ids
            )
            conn.commit()
        return len(ids)
    finally:
        conn.close()


def upsert_diagnose_session(
    session_id: str,
    question: str,
    machine: str | None,
    history: list[dict],
    retrieved_doc_ids: list[int],
    is_resolved: bool,
    final_resolution: str | None = None,
    confidence: str | None = None,
    organization_id: str | None = None,
    factory_id: str | None = None,
    user_id: str | None = None,
) -> None:
    conn = connect()
    try:
        conn.execute(
            """
            INSERT INTO diagnose_sessions
                (session_id, machine, question, history_json, retrieved_doc_ids_json,
                 is_resolved, final_resolution, confidence, organization_id, factory_id, user_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                history_json = excluded.history_json,
                retrieved_doc_ids_json = excluded.retrieved_doc_ids_json,
                is_resolved = excluded.is_resolved,
                final_resolution = excluded.final_resolution,
                confidence = excluded.confidence,
                organization_id = COALESCE(excluded.organization_id, diagnose_sessions.organization_id),
                factory_id = COALESCE(excluded.factory_id, diagnose_sessions.factory_id),
                user_id = COALESCE(excluded.user_id, diagnose_sessions.user_id),
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                session_id, machine, question,
                json.dumps(history, ensure_ascii=False),
                json.dumps(retrieved_doc_ids),
                int(is_resolved), final_resolution, confidence,
                organization_id, factory_id, user_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def list_diagnose_sessions(limit: int = 200, factory_id: str | None = None) -> list[dict]:
    conn = connect()
    try:
        where, params = _factory_where(factory_id)
        rows = conn.execute(
            f"""
            SELECT session_id, machine, question, is_resolved, final_resolution,
                   confidence, rating, feedback_comment, created_at, updated_at,
                   (SELECT COUNT(*) FROM json_each(history_json)) AS turn_count
            FROM diagnose_sessions{where}
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
        return [
            {
                "session_id": r["session_id"],
                "machine": r["machine"],
                "question": r["question"],
                "is_resolved": bool(r["is_resolved"]),
                "final_resolution": r["final_resolution"],
                "confidence": r["confidence"],
                "rating": r["rating"],
                "feedback_comment": r["feedback_comment"],
                "turn_count": r["turn_count"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_diagnose_session(session_id: str, factory_id: str | None = None) -> dict | None:
    conn = connect()
    try:
        if factory_id:
            row = conn.execute(
                """
                SELECT session_id, machine, question, history_json, retrieved_doc_ids_json,
                       is_resolved, final_resolution, confidence, rating, feedback_comment,
                       organization_id, factory_id, user_id, created_at, updated_at
                FROM diagnose_sessions WHERE session_id = ? AND factory_id = ?
                """,
                (session_id, factory_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT session_id, machine, question, history_json, retrieved_doc_ids_json,
                       is_resolved, final_resolution, confidence, rating, feedback_comment,
                       organization_id, factory_id, user_id, created_at, updated_at
                FROM diagnose_sessions WHERE session_id = ?
                """,
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "session_id": row["session_id"],
            "machine": row["machine"],
            "question": row["question"],
            "history": json.loads(row["history_json"]),
            "retrieved_doc_ids": json.loads(row["retrieved_doc_ids_json"]),
            "is_resolved": bool(row["is_resolved"]),
            "final_resolution": row["final_resolution"],
            "confidence": row["confidence"],
            "rating": row["rating"],
            "feedback_comment": row["feedback_comment"],
            "organization_id": row["organization_id"],
            "factory_id": row["factory_id"],
            "user_id": row["user_id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
    finally:
        conn.close()


def update_diagnose_feedback(
    session_id: str,
    rating: int,
    comment: str | None = None,
    factory_id: str | None = None,
) -> bool:
    conn = connect()
    try:
        if factory_id:
            cur = conn.execute(
                """
                UPDATE diagnose_sessions
                SET rating = ?, feedback_comment = ?, updated_at = CURRENT_TIMESTAMP
                WHERE session_id = ? AND factory_id = ?
                """,
                (rating, comment, session_id, factory_id),
            )
        else:
            cur = conn.execute(
                "UPDATE diagnose_sessions SET rating = ?, feedback_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?",
                (rating, comment, session_id),
            )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def list_knowledge_entries(limit: int = 100, factory_id: str | None = None) -> list[dict]:
    conn = connect()
    try:
        clause = " AND factory_id = ?" if factory_id else ""
        params = (factory_id, limit) if factory_id else (limit,)
        rows = conn.execute(
            f"""
            SELECT id, text, metadata_json, created_at
            FROM documents
            WHERE kind = 'knowledge_entry'{clause}
            ORDER BY id DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [
            {
                "id": r["id"],
                "text": r["text"],
                "metadata": json.loads(r["metadata_json"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def insert_uploaded_file(
    *,
    organization_id: str,
    factory_id: str,
    uploaded_by_user_id: str | None,
    original_filename: str,
    local_path: str,
    content_type: str | None,
    size_bytes: int | None,
) -> str:
    conn = connect()
    try:
        file_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO uploaded_files
                (id, organization_id, factory_id, uploaded_by_user_id,
                 original_filename, local_path, content_type, size_bytes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file_id,
                organization_id,
                factory_id,
                uploaded_by_user_id,
                original_filename,
                local_path,
                content_type,
                size_bytes,
            ),
        )
        conn.commit()
        return file_id
    finally:
        conn.close()


def list_uploaded_files(factory_id: str) -> list[dict]:
    conn = connect()
    try:
        rows = conn.execute(
            """
            SELECT id, original_filename, local_path, size_bytes, content_type, created_at
            FROM uploaded_files
            WHERE factory_id = ?
            ORDER BY created_at DESC
            """,
            (factory_id,),
        ).fetchall()
        return [
            {
                "id": r["id"],
                "name": r["original_filename"],
                "local_path": r["local_path"],
                "size": r["size_bytes"] or 0,
                "content_type": r["content_type"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        conn.close()


def get_uploaded_file_by_name(factory_id: str, filename: str) -> dict | None:
    conn = connect()
    try:
        row = conn.execute(
            """
            SELECT id, original_filename, local_path, size_bytes, content_type, created_at
            FROM uploaded_files
            WHERE factory_id = ? AND original_filename = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (factory_id, filename),
        ).fetchone()
        if not row:
            return None
        return {
            "id": row["id"],
            "name": row["original_filename"],
            "local_path": row["local_path"],
            "size": row["size_bytes"] or 0,
            "content_type": row["content_type"],
            "created_at": row["created_at"],
        }
    finally:
        conn.close()
