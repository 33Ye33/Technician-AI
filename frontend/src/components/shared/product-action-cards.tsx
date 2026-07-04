import type { ComponentType } from "react";
import { BookOpenCheck, ClipboardPenLine, MessageSquare, Stethoscope, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/i18n";

type ActionId = "ask" | "diagnose" | "upload" | "field";

interface ProductActionCardsProps {
  compact?: boolean;
  onAsk?: () => void;
  onDiagnose?: () => void;
  onUpload?: () => void;
  onFieldKnowledge?: () => void;
}

const icons: Record<ActionId, ComponentType<{ className?: string }>> = {
  ask: MessageSquare,
  diagnose: Stethoscope,
  upload: UploadCloud,
  field: ClipboardPenLine,
};

export function ProductActionCards({
  compact = false,
  onAsk,
  onDiagnose,
  onUpload,
  onFieldKnowledge,
}: ProductActionCardsProps) {
  const { t } = useLang();
  const actions: {
    id: ActionId;
    title: string;
    desc: string;
    onClick?: () => void;
  }[] = [
    { id: "ask", title: t.action_ask, desc: t.action_ask_desc, onClick: onAsk },
    { id: "diagnose", title: t.action_diagnose, desc: t.action_diagnose_desc, onClick: onDiagnose },
    { id: "upload", title: t.action_upload, desc: t.action_upload_desc, onClick: onUpload },
    { id: "field", title: t.action_field, desc: t.action_field_desc, onClick: onFieldKnowledge },
  ];

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
      {actions.map((action) => {
        const Icon = icons[action.id];
        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className={cn(
              "group flex min-h-[92px] items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-accent/40",
              compact && "min-h-[76px]"
            )}
          >
            <span className="mt-0.5 rounded-md border border-border bg-background p-2 text-primary transition-colors group-hover:border-primary/50">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight text-foreground">{action.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{action.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LibraryIdentityMark() {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md border border-border bg-card p-2 text-primary">
        <BookOpenCheck className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">
          {t.factory_library_title}
        </span>
        <span className="block text-sm text-muted-foreground">{t.factory_library_copy}</span>
      </span>
    </div>
  );
}
