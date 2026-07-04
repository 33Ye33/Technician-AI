import { useState } from "react";
import { Check, X, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/hooks/use-api";
import { useLang } from "@/i18n";
import type { FieldKnowledgePayload } from "@/types/api";

interface FeedbackWidgetProps {
  conversationId: number;
  hideAddNote?: boolean;
}

export function FeedbackWidget({ conversationId, hideAddNote = false }: FeedbackWidgetProps) {
  const { t } = useLang();
  const [state, setState] = useState<"idle" | "failed" | "learned" | "fieldKnowledge" | "done">("idle");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldForm, setFieldForm] = useState<FieldKnowledgePayload>({
    symptom: "",
    machine: "",
    component: "",
    tried: "",
    confirmed_fix: "",
    confidence: "Confirmed",
    technician_note: "",
  });

  function updateField<K extends keyof FieldKnowledgePayload>(key: K, value: FieldKnowledgePayload[K]) {
    setFormError("");
    setFieldForm((current) => ({ ...current, [key]: value }));
  }

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

  async function submitFieldKnowledge() {
    const payload: FieldKnowledgePayload = {
      symptom: fieldForm.symptom.trim(),
      machine: fieldForm.machine?.trim(),
      component: fieldForm.component?.trim(),
      tried: fieldForm.tried?.trim(),
      confirmed_fix: fieldForm.confirmed_fix.trim(),
      confidence: fieldForm.confidence,
      technician_note: fieldForm.technician_note?.trim(),
      source_conversation_id: conversationId,
    };

    if (!payload.symptom || !payload.confirmed_fix) {
      setFormError(t.field_required);
      return;
    }

    try {
      const res = await api.fieldKnowledge(payload);
      setMessage(`${t.field_saved} #${res.id}`);
      setState("done");
    } catch {
      setMessage(t.feedback_failed);
      setState("done");
    }
  }

  if (state === "done") {
    return (
      <div className="pt-2 space-y-2">
        <div className="text-xs font-mono text-secondary">
          {message}
        </div>
        <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium border-2" onClick={() => setState("fieldKnowledge")}>
          <PlusCircle className="h-4 w-4 mr-1.5" /> {t.field_knowledge_button}
        </Button>
      </div>
    );
  }

  if (state === "fieldKnowledge") {
    return (
      <div className="space-y-3 pt-3">
        <div className="grid gap-2">
          <label className="text-xs font-mono text-muted-foreground">{t.field_problem}</label>
          <Textarea
            value={fieldForm.symptom}
            onChange={(e) => updateField("symptom", e.target.value)}
            className="min-h-[54px] text-sm bg-card"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="grid gap-2">
            <label className="text-xs font-mono text-muted-foreground">{t.field_machine}</label>
            <Input
              value={fieldForm.machine}
              onChange={(e) => updateField("machine", e.target.value)}
              className="bg-card"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-mono text-muted-foreground">{t.field_component}</label>
            <Input
              value={fieldForm.component}
              onChange={(e) => updateField("component", e.target.value)}
              className="bg-card"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-mono text-muted-foreground">{t.field_tried}</label>
          <Textarea
            value={fieldForm.tried}
            onChange={(e) => updateField("tried", e.target.value)}
            className="min-h-[54px] text-sm bg-card"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-mono text-muted-foreground">{t.field_fix}</label>
          <Textarea
            value={fieldForm.confirmed_fix}
            onChange={(e) => updateField("confirmed_fix", e.target.value)}
            className="min-h-[54px] text-sm bg-card"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-mono text-muted-foreground">{t.field_confidence}</label>
          <select
            value={fieldForm.confidence}
            onChange={(e) => updateField("confidence", e.target.value as FieldKnowledgePayload["confidence"])}
            className="h-9 rounded-lg border border-input bg-card px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="Confirmed">{t.field_confidence_confirmed}</option>
            <option value="Suspected">{t.field_confidence_suspected}</option>
            <option value="Not sure">{t.field_confidence_unsure}</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-xs font-mono text-muted-foreground">{t.field_note}</label>
          <Textarea
            value={fieldForm.technician_note}
            onChange={(e) => updateField("technician_note", e.target.value)}
            className="min-h-[54px] text-sm bg-card"
          />
        </div>
        {formError && <p className="text-xs text-destructive">{formError}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setState("idle")}>
            {t.feedback_cancel}
          </Button>
          <Button
            size="sm"
            disabled={!fieldForm.symptom.trim() || !fieldForm.confirmed_fix.trim()}
            onClick={submitFieldKnowledge}
          >
            {t.feedback_save}
          </Button>
        </div>
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
        <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-medium border-2" onClick={() => setState("fieldKnowledge")}>
          <PlusCircle className="h-4 w-4 mr-1.5" /> {t.field_knowledge_button}
        </Button>
      </div>
    </div>
  );
}
