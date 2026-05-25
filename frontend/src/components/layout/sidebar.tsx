import { TopicTree } from "@/components/knowledge/topic-tree";
import { UploadForm } from "@/components/ingest/upload-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Topic } from "@/types/api";

interface SidebarProps {
  topics: Topic[];
  onUploadComplete: () => void;
}

export function Sidebar({ topics, onUploadComplete }: SidebarProps) {
  return (
    <aside className="w-full lg:w-[320px] shrink-0 space-y-5">
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
          Knowledge Tree
        </h2>
        <div className="border border-border rounded-sm">
          <ScrollArea className="h-[360px] p-2">
            <TopicTree topics={topics} />
          </ScrollArea>
        </div>
      </section>
      <section>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">
          Add a Manual
        </h2>
        <UploadForm onComplete={onUploadComplete} />
      </section>
    </aside>
  );
}
