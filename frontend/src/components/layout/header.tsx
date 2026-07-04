import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useLang } from "@/i18n";

interface HeaderProps {
  manualCount: number;
  fileCount: number;
  topicCount: number;
  entryCount: number;
  actions?: ReactNode;
}

export function Header({ manualCount, fileCount, topicCount, entryCount, actions }: HeaderProps) {
  const { t } = useLang();
  const stats = [
    { label: t.stat_manuals, value: manualCount },
    { label: t.stat_files, value: fileCount },
    { label: t.stat_notes, value: entryCount },
    { label: t.stat_topics, value: topicCount },
  ];

  return (
    <header>
      <div className="max-w-[1320px] mx-auto px-3 sm:px-6">
        {/* Letterhead row */}
        <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
          <div className="min-w-0">
            <h1 className="font-mono text-[22px] sm:text-[28px] tracking-[0.08em] sm:tracking-[0.12em] leading-none uppercase">
              Technician <span className="text-green-400">AI</span><span className="text-green-400 animate-pulse">_</span>
            </h1>
            <p className="mt-1 text-xs font-mono uppercase tracking-[0.16em] text-primary">
              {t.factory_library_title}
            </p>
            <p className="mt-1 max-w-[620px] text-sm leading-relaxed text-muted-foreground">
              {t.factory_library_copy}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <dl className="hidden sm:flex items-center gap-6 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <dt>{t.factory_library_title}</dt>
              </div>
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground/60">0.1 ALPHA</dt>
              </div>
              <div className="flex items-center gap-1.5">
                <dt>&#9679; ONLINE</dt>
              </div>
            </dl>
            {actions}
            <ThemeToggle />
          </div>
        </div>

        {/* Stats subtitle bar */}
        <div className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4 border-b-2 border-foreground/20">
          {stats.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{item.label}</span>
              <span className="text-sm font-semibold tabular-nums text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
