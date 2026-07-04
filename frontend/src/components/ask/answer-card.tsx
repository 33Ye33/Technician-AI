import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/shared/markdown";
import { SourceList } from "./source-list";
import { FeedbackWidget } from "./feedback-widget";
import { ProcedureCards } from "./procedure-cards";
import { DiagnoseRatingWidget } from "@/components/diagnose-rating-widget";
import type { AskResponse } from "@/types/api";
import { useLang } from "@/i18n";

export function AnswerCard({ result, question }: { result: AskResponse; question?: string }) {
  const { t } = useLang();
  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">
            Response &middot; Conv #{result.conversation_id}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {result.sources.length} source{result.sources.length !== 1 && "s"} cited
          </span>
        </div>
        {question && (
          <p className="text-sm font-medium text-foreground border-l-2 border-muted-foreground/30 pl-3 italic">
            {question}
          </p>
        )}
        <Separator />
        {result.procedure ? (
          <>
            {result.image_observation && (
              <div className="rounded-lg border border-border bg-background/50 p-3">
                <p className="mb-1 text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  {t.image_observation}
                </p>
                <p className="text-sm leading-relaxed text-foreground">{result.image_observation}</p>
                <p className="mt-1.5 text-xs italic text-muted-foreground">
                  {t.image_observation_disclaimer}
                </p>
              </div>
            )}
            <ProcedureCards procedure={result.procedure} />
          </>
        ) : (
          <Markdown>{result.answer}</Markdown>
        )}
        <SourceList sources={result.sources} />
        <FeedbackWidget conversationId={result.conversation_id} hideAddNote />
        <DiagnoseRatingWidget conversationId={result.conversation_id} />
      </CardContent>
    </Card>
  );
}
