import type { AskResponse, DiagnoseResponse } from "@/types/api";

export type AskMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; data: AskResponse };

export type DiagMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; data: DiagnoseResponse };

export type Tab = "ask" | "diagnose";

export interface LibraryStats {
  indexedManuals: number;
  uploadedFiles: number;
  fieldNotes: number;
  topicBuckets: number;
}
