import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/i18n";
import { Header } from "@/components/layout/header";
import { KnowledgeDrawer } from "@/components/layout/knowledge-drawer";
import { AskForm } from "@/components/ask/ask-form";
import { AnswerCard } from "@/components/ask/answer-card";
import { DiagnoseCard } from "@/components/ask/diagnose-card";
import { EntryList } from "@/components/knowledge/entry-list";
import { Spinner } from "@/components/shared/spinner";
import { LibraryIdentityMark, ProductActionCards } from "@/components/shared/product-action-cards";
import { MobileApp } from "@/components/mobile/mobile-app";
import { api } from "@/hooks/use-api";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { AskResponse, DiagnoseResponse, KnowledgeEntry, Topic } from "@/types/api";

type ResultView =
  | { kind: "ask"; data: AskResponse; question: string }
  | { kind: "diagnose"; data: DiagnoseResponse; question: string };

interface Manual {
  title: string;
  chunks: number;
  source_path: string;
}

interface ManualFile {
  name: string;
  size: number;
  url: string;
}

export default function App() {
  const { t } = useLang();
  const [result, setResult] = useState<ResultView | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [manualFiles, setManualFiles] = useState<ManualFile[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const workbenchRef = useRef<HTMLElement>(null);
  const portrait = useMediaQuery("(orientation: portrait)");

  const refresh = useCallback(async () => {
    const [k, t, m, f] = await Promise.all([
      api.knowledge(),
      api.topics(),
      api.manuals(),
      api.manualFiles(),
    ]);
    setEntries(k.entries);
    setTopics(t.topics);
    setManuals(m.manuals);
    setManualFiles(f.files);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAsk(question: string, image?: File, stepByStep = false) {
    setLoading(true);
    setResult(null);
    try {
      const data = image
        ? await api.askPhoto(question, image, stepByStep)
        : await api.ask(question, stepByStep);
      setResult({ kind: "ask", data, question });
    } catch (err) {
      setResult({
        kind: "ask",
        question,
        data: {
          answer: err instanceof Error ? err.message : "Something went wrong.",
          sources: [],
          conversation_id: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDiagnose(question: string) {
    setLoading(true);
    setResult(null);
    try {
      const data = await api.diagnoseStart(question);
      setResult({ kind: "diagnose", data, question });
    } catch (err) {
      setResult({
        kind: "ask",
        question,
        data: {
          answer: err instanceof Error ? err.message : "Diagnose failed.",
          sources: [],
          conversation_id: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  if (portrait) return <MobileApp />;

  function scrollToWorkbench() {
    workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const drawer = (
    <KnowledgeDrawer
      topics={topics}
      open={libraryOpen}
      onOpenChange={setLibraryOpen}
      onUploadComplete={refresh}
    />
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        manualCount={manuals.length}
        fileCount={manualFiles.length}
        topicCount={topics.length}
        entryCount={entries.length}
        actions={drawer}
      />

      <div className="flex-1 max-w-[1120px] mx-auto w-full px-3 sm:px-6 py-4 sm:py-5 pb-safe">
        <main className="space-y-5">
          <section className="space-y-3">
            <LibraryIdentityMark />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryTile label={t.stat_manuals} value={manuals.length} />
              <SummaryTile label={t.stat_files} value={manualFiles.length} />
              <SummaryTile label={t.stat_notes} value={entries.length} />
              <SummaryTile label={t.stat_topics} value={topics.length} />
            </div>
            <ProductActionCards
              onAsk={scrollToWorkbench}
              onDiagnose={scrollToWorkbench}
              onUpload={() => setLibraryOpen(true)}
              onFieldKnowledge={() => setLibraryOpen(true)}
            />
          </section>

          <section ref={workbenchRef}>
            <h2 className="text-sm font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
              &sect; &nbsp;{t.technician_workbench}
            </h2>
            <AskForm onSubmit={handleAsk} onDiagnose={handleDiagnose} loading={loading} />
          </section>

          {loading && <Spinner />}
          {result?.kind === "ask" && !loading && <AnswerCard result={result.data} question={result.question} />}
          {result?.kind === "diagnose" && !loading && <DiagnoseCard initial={result.data} question={result.question} />}

          {entries.length > 0 && (
            <section>
              <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2 mt-6">
                &sect; &nbsp;Captured Knowledge
              </h2>
              <EntryList entries={entries} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
