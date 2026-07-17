import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  Database,
  Factory,
  LogIn,
  Route,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-provider";

export function AuthScreen() {
  const { session, user, signIn, signUp, createWorkspace, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [view, setView] = useState<"landing" | "form">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const needsWorkspace = Boolean(session && !user);
  const workspaceMode = mode === "signup" || needsWorkspace;

  function openForm(nextMode: "login" | "signup") {
    setMode(nextMode);
    setView("form");
    setError(null);
    setSuccess(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (needsWorkspace) {
        await createWorkspace(organizationName, factoryName);
      } else if (mode === "signup") {
        const result = await signUp(email, password, organizationName, factoryName);
        if (result.confirmationRequired) {
          setSuccess("Account created. Please check your email to confirm your account, then log in.");
          setPassword("");
          setMode("login");
        }
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  if (!needsWorkspace && view === "landing") {
    return <LandingPage onGetStarted={() => openForm("signup")} onLogIn={() => openForm("login")} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[420px] rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
          Technician AI
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          {workspaceMode ? "Create your factory workspace" : "Log in"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Factory manuals, SOPs, field knowledge, and technician Q&A stay scoped to your factory.
        </p>

        <div className="mt-5 space-y-3">
          {!needsWorkspace && (
            <>
              <Input
                type="email"
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          )}
          {workspaceMode && (
            <>
              <Input
                placeholder="Organization name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
              />
              <Input
                placeholder="Factory name"
                value={factoryName}
                onChange={(e) => setFactoryName(e.target.value)}
                required
              />
            </>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            {success}
          </p>
        )}

        <Button type="submit" className="mt-5 w-full" disabled={loading}>
          {loading ? "Please wait..." : workspaceMode ? "Create workspace" : "Log in"}
        </Button>
        {needsWorkspace ? (
          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            Use a different account
          </button>
        ) : (
          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setError(null);
              setSuccess(null);
              setMode(mode === "signup" ? "login" : "signup");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Log in"
              : "Need an account? Create a factory workspace"}
          </button>
        )}
      </form>
    </div>
  );
}

function LandingPage({ onGetStarted, onLogIn }: { onGetStarted: () => void; onLogIn: () => void }) {
  const features = [
    {
      icon: Database,
      title: "Factory knowledge library",
      body: "Upload manuals, SOPs, repair guides, inspection sheets, drawings, spreadsheets, and field notes.",
    },
    {
      icon: BookOpenCheck,
      title: "Answers with citations",
      body: "Technicians ask natural language questions and trace answers back to the factory's own documents.",
    },
    {
      icon: ShieldCheck,
      title: "Safety-first routing",
      body: "Safety-critical inputs are routed to warnings before normal troubleshooting or model responses.",
    },
    {
      icon: Camera,
      title: "Photo Ask",
      body: "Attach a machine, alarm screen, damaged part, or work-area photo for additional context.",
    },
    {
      icon: Route,
      title: "Step-by-step mode",
      body: "Turn troubleshooting answers into structured instruction cards with tools, checks, and stop conditions.",
    },
    {
      icon: Wrench,
      title: "Field knowledge capture",
      body: "Save verified fixes and technician notes back into the searchable factory knowledge base.",
    },
  ];

  const steps = [
    "Create a factory workspace",
    "Upload company knowledge",
    "Ask with citations",
    "Save field experience",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Factory className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Technician AI</p>
              <p className="text-xs text-muted-foreground">Factory Knowledge Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onLogIn}>
              <LogIn className="size-4" />
              Log in
            </Button>
            <Button type="button" onClick={onGetStarted}>
              Get Started
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1 text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
              Multi-factory pilot demo
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                Factory knowledge, safety routing, and technician Q&A in one workspace.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Technician AI helps factories turn scattered manuals, SOPs, repair guides, inspection sheets,
                drawings, spreadsheets, and field experience into a searchable assistant with citations.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" size="lg" onClick={onGetStarted} className="h-11">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={onLogIn} className="h-11">
                <LogIn className="size-4" />
                Log in
              </Button>
            </div>
            <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
              {["Tenant-scoped RAG", "DeepSeek ready", "OpenAI ready", "Safety Gate"].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="text-sm font-medium">Factory A workspace</p>
                  <p className="text-xs text-muted-foreground">Knowledge stays scoped to this factory</p>
                </div>
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">Live demo</span>
              </div>
              <div className="mt-4 grid gap-2">
                {[
                  ["Manuals & SOPs", "Indexed with citations"],
                  ["Field fixes", "Saved as searchable knowledge"],
                  ["Safety inputs", "Held before troubleshooting"],
                  ["Provider", "DeepSeek or OpenAI per factory"],
                ].map(([label, detail]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3">
                    <span className="text-sm text-foreground">{label}</span>
                    <span className="text-right text-xs text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/40">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-7 sm:grid-cols-3 sm:px-6">
            {[
              ["Pain point", "Factory knowledge is often spread across PDFs, spreadsheets, binders, and technician memory."],
              ["Pilot answer", "Each factory gets its own workspace so documents, conversations, and field knowledge stay isolated."],
              ["Model choice", "Factories can choose DeepSeek for China-friendly deployments or OpenAI where available."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-border bg-background p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Core features</p>
              <h2 className="mt-2 text-2xl font-semibold">Built for factory technicians</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              This is a public demo, not a finished production safety system. Technicians should still follow
              site procedures, lockout/tagout rules, and supervisor guidance.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-lg border border-border bg-card p-4">
                  <Icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
          <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[0.9fr_1.1fr] sm:p-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">How it works</p>
              <h2 className="mt-2 text-2xl font-semibold">From upload to cited answer</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The assistant combines factory-scoped retrieval with the selected model provider. API keys stay
                backend-only; factory settings only choose configured providers and models.
              </p>
            </div>
            <div className="grid gap-2">
              {steps.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col items-stretch justify-between gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold">Ready to try the demo?</p>
              <p className="text-sm text-muted-foreground">Create a workspace or log in to an existing factory account.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={onLogIn}>
                <LogIn className="size-4" />
                Log in
              </Button>
              <Button type="button" onClick={onGetStarted}>
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
