import { useState } from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";
import type { Tab } from "./types";

interface ChatComposerProps {
  tab: Tab;
  loading: boolean;
  onSubmit: (text: string) => void;
}

export function ChatComposer({ tab, loading, onSubmit }: ChatComposerProps) {
  const [text, setText] = useState("");
  const { t } = useLang();

  function send() {
    const v = text.trim();
    if (!v || loading) return;
    onSubmit(v);
    setText("");
  }

  const placeholder = tab === "ask" ? t.placeholder_ask : t.placeholder_diagnose;

  return (
    <div className="flex items-end gap-2 px-3 py-2.5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={1}
        className="min-h-[44px] max-h-[140px] resize-none text-sm bg-card rounded-2xl py-3"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        size="icon"
        className="h-11 w-11 rounded-full shrink-0"
        disabled={loading || !text.trim()}
        onClick={send}
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
