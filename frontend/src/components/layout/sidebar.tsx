import { TopicTree } from "@/components/knowledge/topic-tree";
import { UploadForm } from "@/components/ingest/upload-form";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Topic } from "@/types/api";

interface SidebarProps {
  topics: Topic[];
  onUploadComplete: () => void;
}

export function Sidebar({ topics, onUploadComplete }: SidebarProps) {
  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-6">
      <section>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          A &mdash; Knowledge Index
        </h2>
        <ScrollArea className="h-[320px] border border-border rounded-lg p-3">
          <TopicTree topics={topics} />
        </ScrollArea>
      </section>
      <Separator />
      <section>
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          B &mdash; Ingest Manual
        </h2>
        <UploadForm onComplete={onUploadComplete} />
      </section>
    </aside>
  );
}
