import type {
  AskConversation,
  AskResponse,
  DiagnoseResponse,
  DiagnoseSession,
  FieldKnowledgePayload,
  FieldKnowledgeResponse,
  FeedbackResponse,
  IngestResponse,
  KnowledgeEntry,
  Topic,
} from "@/types/api";

async function post<T>(url: string, body: FormData | Record<string, string>): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(url, {
    method: "POST",
    body: isFormData ? body : new URLSearchParams(body),
    headers: isFormData ? undefined : { "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function httpDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  ask: (question: string) => post<AskResponse>("/api/ask", { question }),

  askPhoto: (question: string, image: File) => {
    const fd = new FormData();
    fd.append("question", question);
    fd.append("image", image);
    return post<AskResponse>("/api/ask/photo", fd);
  },

  feedback: (conversationId: number, kind: string, note?: string) =>
    post<FeedbackResponse>(`/api/feedback/${conversationId}`, {
      kind,
      ...(note ? { note } : {}),
    }),

  fieldKnowledge: (payload: FieldKnowledgePayload) => {
    const body: Record<string, string> = {
      symptom: payload.symptom,
      confirmed_fix: payload.confirmed_fix,
      confidence: payload.confidence,
      ...(payload.machine ? { machine: payload.machine } : {}),
      ...(payload.component ? { component: payload.component } : {}),
      ...(payload.tried ? { tried: payload.tried } : {}),
      ...(payload.technician_note ? { technician_note: payload.technician_note } : {}),
      ...(payload.source_conversation_id != null
        ? { source_conversation_id: String(payload.source_conversation_id) }
        : {}),
    };
    return post<FieldKnowledgeResponse>("/api/field-knowledge", body);
  },

  ingest: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return post<IngestResponse>("/api/ingest", fd);
  },

  knowledge: () => get<{ entries: KnowledgeEntry[] }>("/api/knowledge"),

  topics: () => get<{ topics: Topic[] }>("/api/topics"),

  manuals: () => get<{ manuals: { title: string; chunks: number; source_path: string }[] }>("/api/manuals"),

  manualFiles: () => get<{ files: { name: string; size: number; url: string }[] }>("/api/manuals/files"),

  deleteManual: (title: string) => httpDelete<{ deleted_chunks: number }>(`/api/manuals/${encodeURIComponent(title)}`),

  diagnoseStart: (question: string) =>
    post<DiagnoseResponse>("/api/diagnose", { question }),

  diagnoseStep: (sessionId: string, answer: string) =>
    post<DiagnoseResponse>("/api/diagnose/step", { session_id: sessionId, answer }),

  conversations: () =>
    get<{ conversations: AskConversation[] }>("/api/conversations"),

  diagnoseSessions: () =>
    get<{ sessions: DiagnoseSession[] }>("/api/diagnose/sessions"),

  diagnoseSession: (sessionId: string) =>
    get<DiagnoseSession>(`/api/diagnose/sessions/${sessionId}`),

  diagnoseSessionFeedback: (sessionId: string, rating: number, comment?: string) =>
    post<{ ok: boolean }>(`/api/diagnose/sessions/${sessionId}/feedback`, {
      rating: String(rating),
      ...(comment ? { comment } : {}),
    }),

  conversationRating: (conversationId: number, rating: number, comment?: string) =>
    fetch(`/api/conversations/${conversationId}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    }).then((r) => r.json() as Promise<{ ok: boolean }>),
};
