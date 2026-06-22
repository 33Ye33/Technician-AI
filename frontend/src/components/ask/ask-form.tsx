import { useState } from "react";
import { Send, Stethoscope } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";

interface AskFormProps {
  onSubmit: (question: string) => void;
  onDiagnose: (question: string) => void;
  loading: boolean;
}

export function AskForm({ onSubmit, onDiagnose, loading }: AskFormProps) {
  const { t } = useLang();
  const [question, setQuestion] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    onSubmit(q);
  }

  function handleDiagnose() {
    const q = question.trim();
    if (!q || loading) return;
    onDiagnose(q);
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-[11px] font-mono text-foreground tracking-wide mb-2">
        {t.ask_instruction}
      </p>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder=""
        className="min-h-[110px] resize-none font-mono text-[13px] leading-relaxed bg-card border-border rounded-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground font-mono tracking-wide">
          {t.ask_enter_hint}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={loading || !question.trim()}
            size="sm"
            className="font-mono text-[11px] uppercase tracking-wider h-7 px-3"
            onClick={handleDiagnose}
          >
            <Stethoscope className="h-3 w-3 mr-1.5" />
            {t.btn_diagnose}
          </Button>
          <Button
            type="submit"
            variant="secondary"
            disabled={loading || !question.trim()}
            size="sm"
            className="font-mono text-[11px] uppercase tracking-wider h-7 px-3"
          >
            <Send className="h-3 w-3 mr-1.5" />
            {t.btn_quick_ask}
          </Button>
        </div>
      </div>
    </form>
  );
}
