import type { Resolution } from "@/types/api";

const confidenceClass: Record<Resolution["confidence_level"], string> = {
  high: "confidence-high",
  medium: "confidence-medium",
  low: "confidence-low",
};

const LABELS = {
  likely_cause: "Likely cause:",
  next_steps: "Next steps:",
  confirmed_condition: "Confirmed condition:",
  confidence_level: "Confidence level:",
  confidence: { high: "High", medium: "Medium", low: "Low" },
  escalate: "Please contact your supervisor or ask for help.",
};

export function ResolutionCard({ resolution }: { resolution: Resolution }) {
  const { likely_cause, next_steps, confirmed_condition, confidence_level, confidence_justification } = resolution;

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <div>
        <p className="font-bold mb-1 text-amber-500">{LABELS.likely_cause}</p>
        <p>{likely_cause || "—"}</p>
      </div>

      <div>
        <p className="font-bold mb-1 text-blue-500">{LABELS.next_steps}</p>
        {next_steps.length > 0 ? (
          <ol className="list-decimal list-inside space-y-1">
            {next_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : (
          <p>—</p>
        )}
      </div>

      <div>
        <p className="font-bold mb-1 text-violet-500">{LABELS.confirmed_condition}</p>
        <p>{confirmed_condition || "—"}</p>
      </div>

      <div>
        <p className="font-bold mb-1 text-emerald-500">{LABELS.confidence_level}</p>
        <span className={confidenceClass[confidence_level]}>
          {LABELS.confidence[confidence_level]}
        </span>
        {confidence_justification && (
          <p className="text-muted-foreground mt-1">{confidence_justification}</p>
        )}
        {confidence_level === "low" && (
          <p className="mt-2 font-medium confidence-low">{LABELS.escalate}</p>
        )}
      </div>
    </div>
  );
}
