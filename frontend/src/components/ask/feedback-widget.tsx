import { useState } from "react";
import { Check, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/hooks/use-api";

interface FeedbackWidgetProps {
  conversationId: number;
  hideAddNote?: boolean;
}

export function FeedbackWidget({ conversationId, hideAddNote = false }: FeedbackWidgetProps) {
  const [state, setState] = useState<"idle" | "failed" | "learned" | "done">("idle");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit(kind: string, text?: string) {
    try {
      const res = await api.feedback(conversationId, kind, text);
      setMessage(
        kind === "worked"
          ? "Marked as worked. Thanks!"
          : `Added entry #${res.id}: ${res.question}`
      );
      setState("done");
    } catch {
      setMessage("Failed to submit feedback.");
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
    const label = state === "failed"
      ? "What actually happened on the floor?"
      : "What tip or context was missing?";
    return (
      <div className="space-y-2 pt-2">
        <label className="text-xs font-mono text-muted-foreground">{label}</label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe what you learned..."
          className="min-h-[60px] text-sm bg-card"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setState("idle")}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!note.trim()}
            onClick={() => submit(state, note.trim())}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-2">
      <span className="text-xs font-semibold text-foreground">Did this fix the issue?</span>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-8 text-sm border-2 font-medium" onClick={() => submit("worked")}>
          <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> Worked
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-sm border-2 font-medium" onClick={() => setState("failed")}>
          <X className="h-3.5 w-3.5 mr-1.5 text-destructive" /> Didn't work
        </Button>
        {!hideAddNote && (
          <Button variant="outline" size="sm" className="h-8 text-sm border-2 font-medium" onClick={() => setState("learned")}>
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Add note
          </Button>
        )}
      </div>
    </div>
  );
}
