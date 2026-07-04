import { useEffect, useRef, useState } from "react";
import { Camera, ListChecks, Send, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";
import type { Tab } from "./types";

interface ChatComposerProps {
  tab: Tab;
  loading: boolean;
  onSubmit: (text: string, image?: File, stepByStep?: boolean) => void;
}

export function ChatComposer({ tab, loading, onSubmit }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [stepByStep, setStepByStep] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLang();
  const canAttachPhoto = tab === "ask";

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function send() {
    const v = text.trim();
    if (!v || loading) return;
    onSubmit(v, canAttachPhoto ? image ?? undefined : undefined, canAttachPhoto && stepByStep);
    setText("");
    setImage(null);
  }

  const placeholder = tab === "ask" ? t.placeholder_ask : t.placeholder_diagnose;

  return (
    <div className="px-3 py-2.5">
      {canAttachPhoto && image && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="h-9 w-9 rounded-md object-cover"
            />
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {image.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setImage(null)}
            aria-label={t.photo_remove}
            title={t.photo_remove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {canAttachPhoto && (
        <div className="mb-2">
          <Button
            type="button"
            variant={stepByStep ? "secondary" : "ghost"}
            size="sm"
            disabled={loading}
            className="h-7 rounded-full px-3 text-[11px] font-mono uppercase tracking-wider"
            onClick={() => setStepByStep((v) => !v)}
            aria-pressed={stepByStep}
          >
            <ListChecks className="h-3.5 w-3.5 mr-1.5" />
            {t.step_by_step}
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        {canAttachPhoto && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full shrink-0"
              disabled={loading}
              onClick={() => imageInputRef.current?.click()}
              aria-label={t.photo_attach}
              title={t.photo_attach}
            >
              <Camera className="h-4 w-4" />
            </Button>
          </>
        )}
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
    </div>
  );
}
