# Render Demo Deployment

This guide deploys Technician AI as a public demo web app on Render.

The demo keeps the current architecture:

- FastAPI backend
- React frontend built into `static/`
- Supabase Auth
- Local SQLite database
- Local `manuals/` upload folder
- Factory-level DeepSeek / OpenAI / Google / Anthropic provider selection

This is not a production deployment. SQLite and local file uploads are suitable
for a quick demo only unless you add durable storage.

## 1. Render Service

Create a new Render **Web Service** from this GitHub repository.

Recommended settings:

| Setting | Value |
|---|---|
| Runtime | Python |
| Root directory | Leave blank |
| Build command | `pip install -r requirements.txt && cd frontend && npm install && npm run build` |
| Start command | `uvicorn technician_ai.api:app --host 0.0.0.0 --port $PORT` |

`python app.py` also reads Render's `PORT` variable and binds to `0.0.0.0`, but
the direct `uvicorn` start command is preferred for Render because it avoids the
local-development reload process.

## 2. Runtime Folders

The app creates runtime folders as needed:

- `data/` is created by the SQLite connection when `TECHNICIAN_AI_DB` points to
  `./data/tech.db`.
- `manuals/{factory_id}/` is created during document upload before the uploaded
  file is saved.
- The React frontend is built into `static/`, and FastAPI serves
  `static/index.html` plus `/assets/*`.

Render's normal filesystem is ephemeral. Data in `data/` and `manuals/` can be
lost on redeploys, restarts, or instance replacement. For this first public demo,
that is acceptable. For a real pilot, migrate to Supabase Postgres and
Supabase Storage, S3, or Cloudflare R2.

## 3. Render Environment Variables

Add these in Render under **Environment**.

### Supabase Auth

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<your-public-anon-or-publishable-key>
SUPABASE_JWT_SECRET=<your-real-jwt-secret>
TECHNICIAN_AI_DB=./data/tech.db
```

### Frontend Build Variables

Vite reads these at build time. If you change them, redeploy/rebuild the service.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=<your-public-anon-or-publishable-key>
```

Never put `SUPABASE_JWT_SECRET` or provider API keys in frontend variables.

### DeepSeek

```bash
DEEPSEEK_API_KEY=<your-deepseek-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### OpenAI / ChatGPT

```bash
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o-mini
```

### Optional Providers

```bash
GOOGLE_API_KEY=<your-google-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
TECHNICIAN_AI_VISION_MODEL=<vision-capable-model>
PHOTO_ASK_MAX_BYTES=8388608
```

Photo Ask requires a vision-capable provider/model.

### Optional Retrieval / Ingestion

```bash
EMBED_PROVIDER=
EMBED_MODEL=
EMBED_DIM=512
USE_LLM_TAGGER=true
USE_VISION_INGEST=false
```

Without an embedding provider, the app falls back to keyword retrieval, which is
acceptable for a small demo.

## 4. Supabase Auth URL Settings

After Render gives you a public URL, for example:

```text
https://technician-ai-demo.onrender.com
```

open Supabase:

1. Go to **Authentication**.
2. Open **URL Configuration**.
3. Set **Site URL** to:

```text
https://technician-ai-demo.onrender.com
```

4. Add this to **Redirect URLs**:

```text
https://technician-ai-demo.onrender.com/**
```

For local testing, you can also keep:

```text
http://localhost:8000/**
http://127.0.0.1:8000/**
```

The current frontend uses direct email/password Auth calls. Redirect URLs mainly
matter for email confirmation, password recovery, and future OAuth flows.

For public demo testing, you can disable email confirmation in Supabase:

```text
Authentication -> Providers -> Email -> disable email confirmation
```

For production, email confirmation should stay enabled. If confirmation is
enabled, users must click the Supabase confirmation email before logging in.

## 5. Post-Deploy Test Checklist

After the Render deploy is live:

1. Open the Render URL.
2. Sign up with email/password.
3. Create an organization and factory workspace.
4. Log out and log back in.
5. Upload a small PDF, DOCX, or Excel test manual.
6. Confirm the document appears in the Knowledge Library.
7. Ask a question that should retrieve the uploaded document.
8. Confirm the answer includes citations/sources.
9. Open factory AI settings as `org_admin`.
10. Select DeepSeek and ask a normal question.
11. Select OpenAI and ask a normal question.
12. Trigger Safety Gate with a safety-critical input.
13. Save a successful answer as Field Knowledge.
14. Ask a related question and confirm field knowledge can be retrieved.

For tenant isolation:

1. Sign up as User A and create Factory A.
2. Upload a Factory A-only document.
3. Sign up as User B and create Factory B.
4. Confirm User B cannot see Factory A documents.
5. Confirm User B Ask does not retrieve Factory A knowledge.

## 6. Demo Limitations

- This deployment uses local SQLite, not Supabase Postgres.
- Uploaded files are stored on the Render instance filesystem, not Supabase
  Storage or S3.
- Data may be lost across redeploys or restarts unless you add durable storage.
- API keys are configured globally in backend environment variables, not stored
  per factory.
- Factory settings only select among providers already configured on the backend.
- Safety Gate reduces risk but is not a production safety system.
- Step-by-step instructions do not replace supervisor judgment, EHS procedures,
  qualified maintenance work, or lockout/tagout rules.

## 7. Recommended Next Production Steps

- Move SQLite data to Supabase Postgres.
- Move uploaded manuals/files to Supabase Storage, S3, or Cloudflare R2.
- Add invite codes for workers joining an existing factory.
- Add supervisor review before field knowledge is eligible for RAG.
- Add audit logs and stricter role permissions.
- Add deployment observability, rate limits, CORS review, and upload scanning.
