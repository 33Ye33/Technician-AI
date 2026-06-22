import { useState } from "react";
import { Check, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/hooks/use-api";
import { useLang } from "@/i18n";

interface FeedbackWidgetProps {
  conversationId: number;
  hideAddNote?: boolean;
}

export function FeedbackWidget({ conversationId, hideAddNote = false }: FeedbackWidgetProps) {
  const { t } = useLang();
  const [state, setState] = useState<"idle" | "failed" | "learned" | "done">("idle");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(kind: string, text?: string) {
    try {
      const res = await api.feedback(conversationId, kind, text);
      setMessage(
        kind === "worked"
          ? t.feedback_marked_worked
          : `Added entry #${res.id}: ${res.question}`
      );
      setState("done");
    } catch {
      setMessage(t.feedback_failed);
      setState("done");
    }
  }

  if (state === "done") {
    return (
      <div className="text-xs font-mono text-secondary py-2">
        {message}
      </div>
    );
  }

  if (state === "failed" || state === "learned") {
    const label = state === "failed" ? t.feedback_what_happened : t.feedback_what_missing;
    return (
      <div className="space-y-2 pt-2">
        <label className="text-xs font-mono text-muted-foreground">{label}</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.feedback_describe}
          className="min-h-[60px] text-sm bg-card"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setState("idle")}>
            {t.feedback_cancel}
          </Button>
          <Button size="sm" disabled={!note.trim()} onClick={() => submit(state, note.trim())}>
            {t.feedback_save}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2">
      <span className="text-xs font-semibold text-foreground">{t.feedback_did_it_fix}</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="h-9 px-4 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white border-0" onClick={() => submit("worked")}>
          <Check className="h-4 w-4 mr-1.5" /> {t.feedback_worked}
        </Button>
        <Button size="sm" className="h-9 px-4 text-sm font-semibold bg-destructive hover:bg-destructive/80 text-white border-0" onClick={() => setState("failed")}>
          <X className="h-4 w-4 mr-1.5" /> {t.feedback_didnt_work}
        </Button>
        {!hideAddNote && (
          <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium border-2" onClick={() => setState("learned")}>
            <PlusCircle className="h-4 w-4 mr-1.5" /> {t.feedback_add_note}
          </Button>
        )}
      </div>
    </div>
  );
}
