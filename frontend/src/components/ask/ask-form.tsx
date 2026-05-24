import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface AskFormProps {
  onSubmit: (question: string) => void;
  loading: boolean;
}

export function AskForm({ onSubmit, loading }: AskFormProps) {
  const [question, setQuestion] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    onSubmit(q);
    setQuestion("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Describe the issue or ask a question..."
        className="min-h-[100px] resize-none font-sans bg-card"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono">
          Ctrl+Enter to submit
        </span>
        <Button type="submit" disabled={loading || !question.trim()} size="sm">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Submit Query
        </Button>
      </div>
    </form>
  );
}
