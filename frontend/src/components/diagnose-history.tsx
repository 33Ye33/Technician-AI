import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, ChevronDown, ChevronUp, Star } from "lucide-react";
import { api } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { DiagnoseSession } from "@/types/api";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
            {session.machine && (
              <span className="text-[10px] font-mono text-muted-foreground">{session.machine}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{formatDate(session.created_at)}</span>
            {session.turn_count != null && (
              <span className="text-[10px] text-muted-foreground">{session.turn_count} turns</span>
            )}
          </div>
          {session.final_resolution && (
            <p className="text-[10px] text-emerald-600 mt-0.5 line-clamp-1">{session.final_resolution}</p>
          )}
          {session.rating != null && (
            <div className="flex items-center gap-1 mt-1">
              {[1,2,3,4,5].map((n) => (
                <Star key={n} className={cn("h-3 w-3", n <= session.rating! ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/30")} />
              ))}
              {session.feedback_comment && (
                <span className="ml-1 text-[10px] text-muted-foreground line-clamp-1">"{session.feedback_comment}"</span>
              )}
            </div>
          )}
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

export function DiagnoseHistory() {
  const [sessions, setSessions] = useState<DiagnoseSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.diagnoseSessions().then((r) => {
      setSessions(r.sessions);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-xs text-muted-foreground p-4">Loading...</p>;
  if (sessions.length === 0)
    return <p className="text-xs text-muted-foreground p-4">No diagnose sessions yet.</p>;

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <SessionCard key={s.session_id} session={s} />
      ))}
    </div>
  );
}
