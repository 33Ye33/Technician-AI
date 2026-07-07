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
import { getApiAccessToken } from "@/lib/api-auth";

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getApiAccessToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function post<T>(url: string, body: FormData | Record<string, string>): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(url, {
    method: "POST",
    body: isFormData ? body : new URLSearchParams(body),
    headers: authHeaders(isFormData ? undefined : { "Content-Type": "application/x-www-form-urlencoded" }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function httpDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  ask: (question: string, stepByStep = false) =>
    post<AskResponse>("/api/ask", {
      question,
      ...(stepByStep ? { step_by_step: "true" } : {}),
    }),

  askPhoto: (question: string, image: File, stepByStep = false) => {
    const fd = new FormData();
    fd.append("question", question);
    fd.append("image", image);
    if (stepByStep) fd.append("step_by_step", "true");
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
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ rating, comment }),
    }).then((r) => r.json() as Promise<{ ok: boolean }>),

  bootstrapWorkspace: (organizationName: string, factoryName: string) =>
    fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        organization_name: organizationName,
        factory_name: factoryName,
      }),
    }).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json() as Promise<{ user: AuthUserContext }>;
    }),

  me: () => get<{ user: AuthUserContext }>("/api/auth/me"),
};

export interface AuthUserContext {
  user_id: string;
  supabase_user_id: string;
  email: string;
  organization_id: string;
  organization_name: string;
  factory_id: string;
  factory_name: string;
  role: "org_admin" | "supervisor" | "technician" | "viewer";
}
