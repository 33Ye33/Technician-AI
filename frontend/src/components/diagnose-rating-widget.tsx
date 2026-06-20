import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface DiagnoseRatingWidgetProps {
  sessionId?: string;
  conversationId?: number;
  label?: string;
}

const labels = ["", "Wrong", "Partially helpful", "OK", "Good", "Spot on"];

export function DiagnoseRatingWidget({ sessionId, conversationId, label = "Rate this diagnosis" }: DiagnoseRatingWidgetProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!rating || submitting) return;
    setSubmitting(true);
    try {
      if (sessionId) {
        await api.diagnoseSessionFeedback(sessionId, rating, comment.trim() || undefined);
      } else if (conversationId != null) {
        await api.conversationRating(conversationId, rating, comment.trim() || undefined);
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-4 pt-4 border-t border-border text-sm font-mono text-emerald-500 text-center py-2">
        Thanks for the feedback!
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-border space-y-3">
      <p className="text-xs font-semibold text-foreground">{label}</p>

      {/* Stars */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-115 focus:outline-none"
          >
            <Star
              className={cn(
                "h-7 w-7 transition-colors",
                n <= (hover || rating)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/30"
              )}
            />
          </button>
        ))}
        <span className="ml-1 text-xs text-muted-foreground font-mono min-w-[100px]">
          {labels[hover || rating]}
        </span>
      </div>

      {/* Comment box — always visible */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional) — what happened on the floor?"
        className="w-full min-h-[64px] rounded-md border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
      />

      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className={cn(
          "w-full py-2 rounded-md text-sm font-semibold transition-colors",
          rating
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {submitting ? "Saving..." : "Submit Rating"}
      </button>
    </div>
  );
}
