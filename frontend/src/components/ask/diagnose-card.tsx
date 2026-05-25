import { useState } from "react";
import { Send, CheckCircle } from "lucide-react";
import { Markdown } from "@/components/shared/markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SourceList } from "./source-list";
import { Spinner } from "@/components/shared/spinner";
import { api } from "@/hooks/use-api";
import type { DiagnoseResponse } from "@/types/api";

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

interface DiagnoseCardProps {
  initial: DiagnoseResponse;
}

export function DiagnoseCard({ initial }: DiagnoseCardProps) {
  const [sessionId] = useState(initial.session_id);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { role: "assistant", content: initial.message },
  ]);
  const [resolved, setResolved] = useState(initial.is_resolved);
  const [sources, setSources] = useState(initial.sources);
  const [step, setStep] = useState(initial.step);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleStep() {
    const text = answer.trim();
    if (!text || loading) return;

    setHistory((h) => [...h, { role: "user", content: text }]);
    setAnswer("");
    setLoading(true);

    try {
      const res = await api.diagnoseStep(sessionId, text);
      setHistory((h) => [...h, { role: "assistant", content: res.message }]);
      setStep(res.step);
      if (res.is_resolved) {
        setResolved(true);
        setSources(res.sources);
      }
    } catch {
      setHistory((h) => [...h, { role: "assistant", content: "Error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            Diagnostic &middot; Step {step}
          </span>
          {resolved ? (
            <span className="text-xs font-mono text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Root cause confirmed
            </span>
          ) : step < 3 ? (
            <span className="text-xs font-mono text-muted-foreground">
              {step}/3 &mdash; gathering evidence
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              Narrowing down...
            </span>
          )}
        </div>
        <Separator />

        {/* Conversation history */}
        <div className="space-y-2">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`text-sm rounded-sm px-3 py-2 ${
                msg.role === "assistant"
                  ? "bg-muted/50 border border-border"
                  : "bg-primary/10 border border-primary/20"
              }`}
            >
              <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                {msg.role === "assistant" ? "AI" : "You"}
              </span>
              {msg.role === "assistant" ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}
            </div>
          ))}
        </div>

        {loading && <Spinner text="Analyzing..." />}

        {/* Input for next answer */}
        {!resolved && !loading && (
          <div className="space-y-2 pt-1">
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Describe what you see..."
              className="min-h-[60px] text-sm bg-card font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStep();
                }
              }}
            />
            <Button
              size="sm"
              disabled={!answer.trim()}
              onClick={handleStep}
              className="font-mono text-[11px] uppercase tracking-wider"
            >
              <Send className="h-3 w-3 mr-1.5" />
              Continue
            </Button>
          </div>
        )}

        {resolved && sources.length > 0 && <SourceList sources={sources} />}
      </CardContent>
    </Card>
  );
}
