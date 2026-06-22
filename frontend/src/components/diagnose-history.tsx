import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, ChevronDown, ChevronUp, Star, MessageSquare, Stethoscope } from "lucide-react";
import { api } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { AskConversation, DiagnoseSession } from "@/types/api";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StarRow({ rating, comment }: { rating: number | null; comment: string | null }) {
  if (rating == null) return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3 w-3", n <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/30")} />
      ))}
      {comment && <span className="ml-1 text-[10px] text-muted-foreground line-clamp-1">"{comment}"</span>}
    </div>
  );
}

function AskCard({ conv }: { conv: AskConversation }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-muted/50 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground line-clamp-2 leading-snug">{conv.question}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono text-muted-foreground">Quick Ask</span>
            <span className="text-[10px] text-muted-foreground">{formatDate(conv.created_at)}</span>
          </div>
          <StarRow rating={conv.rating} comment={conv.feedback_comment} />
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border divide-y divide-border/50 bg-muted/20">
          <div className="px-3 py-2 bg-background">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">Technician</p>
            <p className="text-xs leading-relaxed">{conv.question}</p>
          </div>
          <div className="px-3 py-2 bg-muted/30">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">AI</p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed">{conv.answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: DiagnoseSession }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<DiagnoseSession | null>(null);

  const toggle = useCallback(async () => {
    if (!expanded && !detail) {
      const d = await api.diagnoseSession(session.session_id);
      setDetail(d);
    }
    setExpanded((v) => !v);
  }, [expanded, detail, session.session_id]);

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <button
        onClick={toggle}
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-muted/50 transition-colors"
      >
        <div className="mt-0.5 shrink-0">
          {session.is_resolved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground line-clamp-2 leading-snug">{session.question}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
              <Stethoscope className="h-2.5 w-2.5" /> {session.machine ?? "Diagnose"}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatDate(session.created_at)}</span>
            {session.turn_count != null && (
              <span className="text-[10px] text-muted-foreground">{session.turn_count} turns</span>
            )}
          </div>
          {session.final_resolution && (
            <p className="text-[10px] text-emerald-600 mt-0.5 line-clamp-1">{session.final_resolution}</p>
          )}
          <StarRow rating={session.rating} comment={session.feedback_comment} />
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>
      {expanded && detail && (
        <div className="border-t border-border divide-y divide-border/50 bg-muted/20">
          {detail.history?.map((turn, i) => (
            <div key={i} className={cn("px-3 py-2", turn.role === "user" ? "bg-background" : "bg-muted/30")}>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                {turn.role === "user" ? "Technician" : "AI"}
              </p>
              <p className="text-xs whitespace-pre-wrap leading-relaxed">{turn.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type HistoryItem =
  | { kind: "ask"; data: AskConversation; date: string }
  | { kind: "diagnose"; data: DiagnoseSession; date: string };

export function DiagnoseHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.diagnoseSessions(), api.conversations()]).then(([dr, cr]) => {
      const merged: HistoryItem[] = [
        ...dr.sessions.map((s) => ({ kind: "diagnose" as const, data: s, date: s.created_at })),
        ...cr.conversations.map((c) => ({ kind: "ask" as const, data: c, date: c.created_at })),
      ];
      merged.sort((a, b) => b.date.localeCompare(a.date));
      setItems(merged);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-xs text-muted-foreground p-4">Loading...</p>;
  if (items.length === 0)
    return <p className="text-xs text-muted-foreground p-4">No history yet.</p>;

  return (
    <div className="space-y-2">
      {items.map((item) =>
        item.kind === "ask" ? (
          <AskCard key={`ask-${item.data.id}`} conv={item.data} />
        ) : (
          <SessionCard key={`diag-${item.data.session_id}`} session={item.data} />
        )
      )}
    </div>
  );
}
