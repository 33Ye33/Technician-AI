import type { Resolution } from "@/types/api";

const confidenceClass: Record<Resolution["confidence_level"], string> = {
  high: "confidence-high",
  medium: "confidence-medium",
  low: "confidence-low",
};

const LABELS = {
  en: {
    likely_cause: "Likely cause:",
    next_steps: "Next steps:",
    confirmed_condition: "Confirmed condition:",
    confidence_level: "Confidence level:",
    confidence: { high: "High", medium: "Medium", low: "Low" },
    escalate: "Please contact your supervisor or ask for help.",
  },
  zh: {
    likely_cause: "可能原因：",
    next_steps: "建议步骤：",
    confirmed_condition: "已确认情况：",
    confidence_level: "置信度：",
    confidence: { high: "高", medium: "中", low: "低" },
    escalate: "请联系您的主管或寻求帮助。",
  },
  es: {
    likely_cause: "Causa probable:",
    next_steps: "Próximos pasos:",
    confirmed_condition: "Condición confirmada:",
    confidence_level: "Nivel de confianza:",
    confidence: { high: "Alto", medium: "Medio", low: "Bajo" },
    escalate: "Comuníquese con su supervisor o pida ayuda.",
  },
};

function detectLang(text: string): keyof typeof LABELS {
  if (/[一-鿿]/.test(text)) return "zh";
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  return "en";
}

export function ResolutionCard({ resolution }: { resolution: Resolution }) {
  const { likely_cause, next_steps, confirmed_condition, confidence_level, confidence_justification } = resolution;
  const lang = detectLang(likely_cause + confirmed_condition);
  const L = LABELS[lang];

  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <div>
        <p className="font-bold mb-1 text-amber-500">{L.likely_cause}</p>
        <p>{likely_cause || "—"}</p>
      </div>

      <div>
        <p className="font-bold mb-1 text-blue-500">{L.next_steps}</p>
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
        <p className="font-bold mb-1 text-violet-500">{L.confirmed_condition}</p>
        <p>{confirmed_condition || "—"}</p>
      </div>

      <div>
        <p className="font-bold mb-1 text-emerald-500">{L.confidence_level}</p>
        <span className={confidenceClass[confidence_level]}>
          {L.confidence[confidence_level]}
        </span>
        {confidence_justification && (
          <p className="text-muted-foreground mt-1">{confidence_justification}</p>
        )}
        {confidence_level === "low" && (
          <p className="mt-2 font-medium confidence-low">{L.escalate}</p>
        )}
      </div>
    </div>
  );
}
