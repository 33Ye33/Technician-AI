import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-provider";

export function AuthScreen() {
  const { session, user, signIn, signUp, createWorkspace, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [factoryName, setFactoryName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const needsWorkspace = Boolean(session && !user);
  const workspaceMode = mode === "signup" || needsWorkspace;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (needsWorkspace) {
        await createWorkspace(organizationName, factoryName);
      } else if (mode === "signup") {
        await signUp(email, password, organizationName, factoryName);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
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
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
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
