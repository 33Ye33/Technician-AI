import { useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

interface DiagnoseFeedbackModalProps {
  sessionId: string;
  onClose: () => void;
}

export function DiagnoseFeedbackModal({ sessionId, onClose }: DiagnoseFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await api.diagnoseSessionFeedback(sessionId, rating, comment.trim() || undefined);
    } finally {
      setDone(true);
      setTimeout(onClose, 1200);
    }
  }

  const labels = ["", "Wrong", "Partially helpful", "OK", "Good", "Spot on"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl p-6 flex flex-col gap-5">
        {done ? (
          <div className="text-center py-4">
            <p className="text-sm font-mono text-emerald-500">Thanks for the feedback!</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">How did the diagnosis go?</p>
              <p className="text-xs text-muted-foreground mt-1">Your rating helps improve future results.</p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      n <= (hover || rating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-muted-foreground/40"
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Label */}
            <p className="text-center text-xs text-muted-foreground h-4">
              {labels[hover || rating]}
            </p>

            {/* Comment */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a note (optional) — what happened on the floor?"
              className="w-full min-h-[72px] rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-xs font-mono text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className={cn(
                  "flex-2 flex-1 py-2 text-xs font-mono rounded-md transition-colors",
                  rating
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
