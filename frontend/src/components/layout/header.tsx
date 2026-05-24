import { ThemeToggle } from "@/components/shared/theme-toggle";

export function Header() {
  return (
    <header className="border-b-2 border-foreground/80">
      <div className="max-w-[1320px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-2xl tracking-tight">Technician AI</h1>
            <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">
              FK-CONSOLE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
              Rev 2.0 &middot; Active
            </span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
