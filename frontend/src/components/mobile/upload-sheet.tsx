import { Sheet } from "@/components/ui/sheet";
import { UploadForm } from "@/components/ingest/upload-form";
import { useLang } from "@/i18n";

interface UploadSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function UploadSheet({ open, onOpenChange, onComplete }: UploadSheetProps) {
  const { t } = useLang();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="bottom" title={t.upload_to_library}>
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          {t.upload_library_desc}
        </p>
        <UploadForm onComplete={onComplete} />
      </div>
    </Sheet>
  );
}
