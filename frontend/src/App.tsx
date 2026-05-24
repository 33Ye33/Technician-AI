import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { AskForm } from "@/components/ask/ask-form";
import { AnswerCard } from "@/components/ask/answer-card";
import { EntryList } from "@/components/knowledge/entry-list";
import { Spinner } from "@/components/shared/spinner";
import { Separator } from "@/components/ui/separator";
import { api } from "@/hooks/use-api";
import type { AskResponse, KnowledgeEntry, Topic } from "@/types/api";

export default function App() {
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const refresh = useCallback(async () => {
    const [k, t] = await Promise.all([api.knowledge(), api.topics()]);
    setEntries(k.entries);
    setTopics(t.topics);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleAsk(question: string) {
    setLoading(true);
    setAnswer(null);
    try {
      const result = await api.ask(question);
      setAnswer(result);
    } catch (err) {
      setAnswer({
        answer: err instanceof Error ? err.message : "Something went wrong.",
        sources: [],
        conversation_id: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 max-w-[1320px] mx-auto w-full px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-xs font-mono text-muted-foreground">
            {topics.length} topic{topics.length !== 1 && "s"}
          </span>
          <span className="text-xs text-muted-foreground">&middot;</span>
          <span className="text-xs font-mono text-muted-foreground">
            {entries.length} field note{entries.length !== 1 && "s"}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0 space-y-6">
            <section>
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                &sect; 01 &mdash; Query
              </h2>
              <AskForm onSubmit={handleAsk} loading={loading} />
            </section>

            {loading && <Spinner />}
            {answer && !loading && <AnswerCard result={answer} />}

            <Separator />

            <section>
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                &sect; 02 &mdash; Captured Knowledge
              </h2>
              <EntryList entries={entries} />
            </section>
          </main>

          <Sidebar topics={topics} onUploadComplete={refresh} />
        </div>
      </div>
    </div>
  );
}
