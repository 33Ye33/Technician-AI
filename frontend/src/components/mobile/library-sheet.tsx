import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Database, Download, FileSpreadsheet, FileText, Tags } from "lucide-react";
import { useLang } from "@/i18n";
import { Sheet } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TopicTree } from "@/components/knowledge/topic-tree";
import { DiagnoseHistory } from "@/components/diagnose-history";
import { cn } from "@/lib/utils";
import type { KnowledgeEntry, Topic } from "@/types/api";
import type { LibraryStats } from "./types";

interface ManualFile {
  name: string;
  size: number;
  url: string;
}
interface Manual {
  title: string;
  chunks: number;
  source_path: string;
}

interface LibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: Topic[];
  manualFiles: ManualFile[];
  manuals: Manual[];
  fieldEntries: KnowledgeEntry[];
  stats: LibraryStats;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibrarySheet({
  open,
  onOpenChange,
  topics,
  manualFiles,
  manuals,
  fieldEntries,
  stats,
}: LibrarySheetProps) {
  const [tab, setTab] = useState<"library" | "history">("library");
  const { t } = useLang();
  const tabs = [
    { id: "library" as const, label: t.tab_library },
    { id: "history" as const, label: t.tab_history },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title={t.factory_library_title}>
      <div className="flex border-b border-border shrink-0">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors",
              tab === tb.id ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        {tab === "library" ? (
          <div className="p-4 space-y-5">
            <section className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="rounded-md border border-border bg-background p-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold leading-tight">{t.factory_library_title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t.factory_library_desc}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <LibraryStat label={t.stat_manuals} value={stats.indexedManuals} />
                <LibraryStat label={t.stat_files} value={stats.uploadedFiles} />
                <LibraryStat label={t.stat_notes} value={stats.fieldNotes} />
                <LibraryStat label={t.stat_topics} value={stats.topicBuckets} />
              </div>
            </section>

            <section>
              <SectionTitle icon={<BookOpen className="h-3.5 w-3.5" />} title={t.manuals_sops} count={manuals.length} />
              <div className="border border-border rounded-sm divide-y divide-border">
                {manuals.length ? manuals.map((m) => (
                  <div key={m.title} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground">{m.title}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {m.chunks} {t.chunks} · {t.indexed}
                      </p>
                    </div>
                  </div>
                )) : <EmptyPanel text={t.no_indexed_manuals} />}
              </div>
            </section>

            <section>
              <SectionTitle icon={<Database className="h-3.5 w-3.5" />} title={t.uploaded_files} count={manualFiles.length} />
              <div className="border border-border rounded-sm divide-y divide-border">
                {manualFiles.length ? manualFiles.map((f) => {
                  const isXlsx = /\.(xlsx|xls)$/i.test(f.name);
                  const isPdf = /\.pdf$/i.test(f.name);
                  const ingested = manuals.find(
                    (m) => m.title === f.name || m.source_path?.endsWith(f.name)
                  );
                  return (
                    <div key={f.name} className="flex items-center gap-2 px-3 py-2">
                      {isXlsx ? (
                        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <a
                          href={f.url}
                          target={isPdf ? "_blank" : undefined}
                          download={!isPdf ? f.name : undefined}
                          rel="noreferrer"
                          className="text-xs truncate block hover:underline text-foreground"
                          title={f.name}
                        >
                          {f.name}
                        </a>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {formatBytes(f.size)}
                          {ingested && <span className="ml-1.5 text-emerald-600">· {t.indexed}</span>}
                        </p>
                      </div>
                      <a
                        href={f.url}
                        download={f.name}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  );
                }) : <EmptyPanel text={t.no_uploaded_files} />}
              </div>
            </section>

            <section>
              <SectionTitle icon={<FileText className="h-3.5 w-3.5" />} title={t.field_knowledge} count={fieldEntries.length} />
              <div className="border border-border rounded-sm divide-y divide-border">
                {fieldEntries.length ? fieldEntries.slice(0, 3).map((entry) => {
                  const title = typeof entry.metadata.title === "string" ? entry.metadata.title : `${t.field_knowledge} #${entry.id}`;
                  return (
                    <div key={entry.id} className="px-3 py-2">
                      <p className="truncate text-xs text-foreground">{title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {entry.text}
                      </p>
                    </div>
                  );
                }) : <EmptyPanel text={t.no_field_knowledge} />}
              </div>
            </section>

            <section>
              <SectionTitle icon={<Tags className="h-3.5 w-3.5" />} title={t.topic_buckets} count={topics.length} />
              <div className="border border-border rounded-sm p-2">
                <TopicTree topics={topics} />
              </div>
            </section>
          </div>
        ) : (
          <div className="p-4">
            <DiagnoseHistory />
          </div>
        )}
      </ScrollArea>
    </Sheet>
  );
}

function LibraryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-2.5 py-2">
      <p className="text-lg font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1 truncate text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count: number;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">
      {icon}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="tabular-nums">{count}</span>
    </h2>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <p className="px-3 py-3 text-center text-[11px] font-mono text-muted-foreground">
      {text}
    </p>
  );
}
