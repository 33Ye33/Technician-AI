import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle, ShieldAlert, MessageSquare, Stethoscope } from "lucide-react";
import { useLang } from "@/i18n";
import { Markdown } from "@/components/shared/markdown";
import { SourceList } from "@/components/ask/source-list";
import { FeedbackWidget } from "@/components/ask/feedback-widget";
import { ResolutionCard } from "@/components/ask/resolution-card";
import { ProcedureCards } from "@/components/ask/procedure-cards";
import { DiagnoseRatingWidget } from "@/components/diagnose-rating-widget";
import { Spinner } from "@/components/shared/spinner";
import { ProductActionCards } from "@/components/shared/product-action-cards";
import type { AskMessage, DiagMessage, Tab } from "./types";

interface ChatThreadProps {
  tab: Tab;
  askMsgs: AskMessage[];
  diagMsgs: DiagMessage[];
  loading: boolean;
  onSelectTab: (tab: Tab) => void;
  onOpenLibrary: () => void;
  onOpenUpload: () => void;
}

export function ChatThread({
  tab,
  askMsgs,
  diagMsgs,
  loading,
  onSelectTab,
  onOpenLibrary,
  onOpenUpload,
}: ChatThreadProps) {
  const { t } = useLang();
  const bottomRef = useRef<HTMLDivElement>(null);
  const count = tab === "ask" ? askMsgs.length : diagMsgs.length;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [count, loading, tab]);

  const empty = count === 0 && !loading;

  return (
    <div className="px-3 py-4 space-y-4">
      {empty && (
        <EmptyState
          tab={tab}
          onSelectTab={onSelectTab}
          onOpenLibrary={onOpenLibrary}
          onOpenUpload={onOpenUpload}
        />
      )}

      {tab === "ask"
        ? askMsgs.map((m, i) => <AskBubble key={i} msg={m} />)
        : diagMsgs.map((m, i) => <DiagBubble key={i} msg={m} />)}

      {loading && (
        <div className="flex justify-start">
          <Spinner text={tab === "ask" ? t.label_searching : t.label_analyzing} />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 border border-primary/20 px-3.5 py-2.5">
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AssistantShell({
  children,
  accent = "primary",
}: {
  children: ReactNode;
  accent?: "primary" | "green" | "destructive";
}) {
  const border =
    accent === "green"
      ? "border-l-green-500"
      : accent === "destructive"
        ? "border-l-destructive"
        : "border-l-primary";
  return (
    <div className="flex justify-start">
      <div className={`max-w-[92%] w-full rounded-xl rounded-bl-sm border border-border border-l-4 ${border} bg-card px-3.5 py-3`}>
        {children}
      </div>
    </div>
  );
}

function AskBubble({ msg }: { msg: AskMessage }) {
  const { t } = useLang();
  if (msg.role === "user") return <UserBubble text={msg.text} />;
  const { data } = msg;
  return (
    <AssistantShell>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t.status_response} &middot; Conv #{data.conversation_id}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {data.sources.length} {t.label_sources}
        </span>
      </div>
      {data.procedure ? (
        <div className="space-y-2.5">
          {data.image_observation && (
            <div className="rounded-lg border border-border bg-background/50 p-3">
              <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t.image_observation}
              </p>
              <p className="text-sm leading-relaxed text-foreground">{data.image_observation}</p>
              <p className="mt-1.5 text-xs italic text-muted-foreground">
                {t.image_observation_disclaimer}
              </p>
            </div>
          )}
          <ProcedureCards procedure={data.procedure} />
        </div>
      ) : (
        <Markdown>{data.answer}</Markdown>
      )}
      <SourceList sources={data.sources} />
      {data.conversation_id > 0 && <FeedbackWidget conversationId={data.conversation_id} hideAddNote />}
      {data.conversation_id > 0 && <DiagnoseRatingWidget conversationId={data.conversation_id} />}
    </AssistantShell>
  );
}

function DiagBubble({ msg }: { msg: DiagMessage }) {
  const { t } = useLang();
  if (msg.role === "user") return <UserBubble text={msg.text} />;
  const { data } = msg;
  const phase = data.phase ?? (data.is_safety_critical ? "safety_hold" : data.is_resolved ? "resolved" : "investigating");
  const safety = phase === "safety_hold";
  const accent = phase === "resolved" ? "green" : safety ? "destructive" : "primary";
  const label =
    phase === "safety_hold" ? t.status_safety_hold
      : phase === "resolved" ? t.status_root_cause
        : phase === "identify_machine" ? t.status_identifying
          : data.machine ? `${t.status_investigating} · ${data.machine}` : t.status_investigating;

  return (
    <AssistantShell accent={accent}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {data.is_resolved ? (
          <span className="text-[10px] font-mono text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> {t.status_root_cause}
          </span>
        ) : safety ? (
          <span className="text-[10px] font-mono text-destructive flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> {t.label_confirm_safe}
          </span>
        ) : null}
      </div>

      {data.is_resolved && data.resolution ? (
        <ResolutionCard resolution={data.resolution} />
      ) : (
        <Markdown>{data.message}</Markdown>
      )}

      {data.is_resolved && data.sources.length > 0 && <SourceList sources={data.sources} />}
      {data.is_resolved && data.conversation_id != null && <FeedbackWidget conversationId={data.conversation_id} hideAddNote />}
      {data.is_resolved && <DiagnoseRatingWidget sessionId={data.session_id} />}
    </AssistantShell>
  );
}

function EmptyState({
  tab,
  onSelectTab,
  onOpenLibrary,
  onOpenUpload,
}: {
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  onOpenLibrary: () => void;
  onOpenUpload: () => void;
}) {
  const { t } = useLang();
  const Icon = tab === "ask" ? MessageSquare : Stethoscope;
  const title = tab === "ask" ? t.empty_ask_title : t.empty_diagnose_title;
  const sub = tab === "ask" ? t.empty_ask_desc : t.empty_diagnose_desc;
  return (
    <div className="px-2 pt-5">
      <div className="flex flex-col items-center justify-center text-center px-4">
        <div className="rounded-full border border-border bg-card p-3 mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1.5">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">{sub}</p>
      </div>
      <div className="mt-5">
        <ProductActionCards
          onAsk={() => onSelectTab("ask")}
          onDiagnose={() => onSelectTab("diagnose")}
          onUpload={onOpenUpload}
          onFieldKnowledge={onOpenLibrary}
        />
      </div>
    </div>
  );
}
