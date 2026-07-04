import { ListTree, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useLang } from "@/i18n";
import type { LibraryStats } from "./types";

interface MobileTopBarProps {
  stats: LibraryStats;
  onOpenLibrary: () => void;
  onOpenUpload: () => void;
}

export function MobileTopBar({ stats, onOpenLibrary, onOpenUpload }: MobileTopBarProps) {
  const { t } = useLang();
  const statItems = [
    { label: t.stat_manuals, value: stats.indexedManuals },
    { label: t.stat_files, value: stats.uploadedFiles },
    { label: t.stat_notes, value: stats.fieldNotes },
    { label: t.stat_topics, value: stats.topicBuckets },
  ];

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <h1 className="font-mono text-[17px] tracking-[0.06em] leading-none uppercase">
            Technician <span className="text-green-400">AI</span>
            <span className="text-green-400 animate-pulse">_</span>
          </h1>
          <p className="mt-1 truncate text-[11px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
            {t.factory_library_title}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenLibrary}
            title={t.open_library}
            aria-label={t.open_library}
          >
            <ListTree className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenUpload}
            title={t.upload_to_library}
            aria-label={t.upload_to_library}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1 px-3 pb-2">
        {statItems.map((item) => (
          <div key={item.label} className="rounded-md border border-border bg-card/70 px-2 py-1">
            <p className="text-[13px] font-semibold tabular-nums leading-none text-foreground">{item.value}</p>
            <p className="mt-0.5 truncate text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
