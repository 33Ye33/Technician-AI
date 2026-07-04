import { AlertTriangle, CheckCircle2, ClipboardList, ListChecks, Wrench } from "lucide-react";
import { useLang } from "@/i18n";
import type { StepProcedure } from "@/types/api";

export function ProcedureCards({ procedure }: { procedure: StepProcedure }) {
  const { t } = useLang();
  return (
    <div className="space-y-2.5">
      <ProcedureSection title={t.procedure_safety} Icon={AlertTriangle} items={procedure.safety_first} accent="text-amber-400" />
      <ProcedureSection title={t.procedure_tools} Icon={Wrench} items={procedure.tools_needed} />

      <section className="rounded-lg border border-border bg-background/50 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5 text-primary" />
          {t.procedure_steps}
        </div>
        <div className="space-y-2">
          {procedure.steps.map((step, index) => (
            <div key={`${index}-${step.instruction}`} className="rounded-md border border-border/70 bg-card px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                {step.title && <h4 className="text-sm font-semibold leading-snug text-foreground">{step.title}</h4>}
              </div>
              <p className="text-sm leading-relaxed text-foreground">{step.instruction}</p>
              {step.expected_result && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {step.expected_result}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <ProcedureTextBlock title={t.procedure_expected} Icon={CheckCircle2} text={procedure.expected_result} />
      <ProcedureSection title={t.procedure_stop} Icon={ClipboardList} items={procedure.stop_and_ask_supervisor} accent="text-destructive" />
    </div>
  );
}

function ProcedureSection({
  title,
  Icon,
  items,
  accent = "text-primary",
}: {
  title: string;
  Icon: typeof AlertTriangle;
  items: string[];
  accent?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProcedureTextBlock({
  title,
  Icon,
  text,
}: {
  title: string;
  Icon: typeof CheckCircle2;
  text: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-emerald-400" />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </section>
  );
}
