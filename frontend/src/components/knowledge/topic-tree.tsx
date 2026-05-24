import { FolderOpen } from "lucide-react";
import type { Topic } from "@/types/api";

export function TopicTree({ topics }: { topics: Topic[] }) {
  if (!topics.length) {
    return (
      <p className="text-xs text-muted-foreground font-mono py-4 text-center">
        No topics yet. Upload a manual to get started.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {topics.map((t) => (
        <div
          key={t.path}
          className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5 text-secondary shrink-0" />
          <span className="text-xs font-mono text-foreground/80 truncate flex-1">
            {t.path}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {t.count}
          </span>
        </div>
      ))}
    </div>
  );
}
