export interface Source {
  index: number;
  id: number;
  kind: "manual_chunk" | "knowledge_entry";
  metadata: Record<string, unknown>;
  preview: string;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  conversation_id: number;
}

export interface KnowledgeEntry {
  id: number;
  kind: string;
  text: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Topic {
  path: string;
  count: number;
  documents?: KnowledgeEntry[];
}

export interface IngestResponse {
  filename: string;
  chunks: number;
}

export interface FeedbackResponse {
  id?: number;
  question?: string;
  answer?: string;
  message?: string;
}
