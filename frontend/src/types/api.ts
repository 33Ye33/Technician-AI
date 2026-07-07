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
  mode?: "normal" | "step_by_step";
  procedure?: StepProcedure;
  image_observation?: string;
  is_safety_critical?: boolean;
  hazard_type?: string | null;
}

export interface StepProcedure {
  safety_first: string[];
  tools_needed: string[];
  steps: StepProcedureStep[];
  expected_result: string;
  stop_and_ask_supervisor: string[];
}

export interface StepProcedureStep {
  title?: string;
  instruction: string;
  expected_result?: string;
}

export interface KnowledgeEntry {
  id: number;
  kind: string;
  text: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Topic {
  path: string | string[];
  count?: number;
  manual_count?: number;
  knowledge_count?: number;
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

export interface FieldKnowledgePayload {
  symptom: string;
  confirmed_fix: string;
  machine?: string;
  component?: string;
  tried?: string;
  confidence: "Confirmed" | "Suspected" | "Not sure";
  technician_note?: string;
  source_conversation_id?: number;
}

export interface FieldKnowledgeResponse {
  id: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface LlmSettings {
  llm_provider: "deepseek" | "openai" | "google" | "anthropic";
  llm_model: string;
  llm_base_url?: string | null;
}

export interface Resolution {
  likely_cause: string;
  next_steps: string[];
  confirmed_condition: string;
  confidence_level: "high" | "medium" | "low";
  confidence_justification: string;
}

export interface DiagnoseResponse {
  message: string;
  is_resolved: boolean;
  resolution?: Resolution | null;
  sources: Source[];
  conversation_id: number | null;
  session_id: string;
  step: number;
  phase?: "identify_machine" | "investigating" | "resolved" | "safety_hold";
  machine?: string | null;
  is_safety_critical?: boolean;
  hazard_type?: string | null;
}

export interface DiagnoseHistoryTurn {
  role: "user" | "assistant";
  text: string;
  doc_ids?: number[];
  step: number;
}

export interface AskConversation {
  id: number;
  question: string;
  answer: string;
  rating: number | null;
  feedback_comment: string | null;
  created_at: string;
}

export interface DiagnoseSession {
  session_id: string;
  machine: string | null;
  question: string;
  is_resolved: boolean;
  final_resolution: string | null;
  confidence: string | null;
  rating: number | null;
  feedback_comment: string | null;
  turn_count?: number;
  history?: DiagnoseHistoryTurn[];
  created_at: string;
  updated_at: string;
}
