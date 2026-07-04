import { useEffect, useRef, useState } from "react";
import { Camera, Send, Stethoscope, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n";

interface AskFormProps {
  onSubmit: (question: string, image?: File) => void;
  onDiagnose: (question: string) => void;
  loading: boolean;
}

export function AskForm({ onSubmit, onDiagnose, loading }: AskFormProps) {
  const { t } = useLang();
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    onSubmit(q, image ?? undefined);
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
      {image && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-card px-2 py-2">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="h-10 w-10 rounded-sm object-cover"
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
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground font-mono tracking-wide">
          {t.ask_enter_hint}
        </span>
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            size="icon"
            className="h-7 w-7"
            onClick={() => imageInputRef.current?.click()}
            aria-label={t.photo_attach}
            title={t.photo_attach}
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>
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
