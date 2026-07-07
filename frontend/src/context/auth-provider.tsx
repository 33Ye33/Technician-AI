import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { setApiAccessToken } from "@/lib/api-auth";
import { api, type AuthUserContext } from "@/hooks/use-api";

interface AuthSession {
  access_token: string;
  refresh_token?: string;
  user: { email?: string };
}

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUserContext | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    organizationName: string,
    factoryName: string,
  ) => Promise<void>;
  createWorkspace: (organizationName: string, factoryName: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "technician_ai_auth_session";

function supabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error("Supabase frontend env vars are not configured.");
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

async function supabaseAuth(path: string, body: Record<string, unknown>) {
  const { url, anonKey } = supabaseConfig();
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || data?.message || "Authentication failed");
  }
  return data;
}

function saveSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setApiAccessToken(session.access_token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    setApiAccessToken(null);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUserContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoading(false);
      return;
    }
    try {
      const saved = JSON.parse(raw) as AuthSession;
      setSession(saved);
      setApiAccessToken(saved.access_token);
      api.me()
        .then((res) => setUser(res.user))
        .catch((err) => {
          if (err instanceof Error && err.message.includes("409")) {
            setUser(null);
            return;
          }
          saveSession(null);
          setSession(null);
        })
        .finally(() => setLoading(false));
    } catch {
      saveSession(null);
      setLoading(false);
    }
  }, []);

  async function signIn(email: string, password: string) {
    const data = await supabaseAuth("token?grant_type=password", { email, password });
    const next = data as AuthSession;
    setSession(next);
    saveSession(next);
    try {
      const me = await api.me();
      setUser(me.user);
    } catch (err) {
      if (err instanceof Error && err.message.includes("409")) {
        setUser(null);
        return;
      }
      setSession(null);
      saveSession(null);
      throw err;
    }
  }

  async function createWorkspace(organizationName: string, factoryName: string) {
    const bootstrapped = await api.bootstrapWorkspace(organizationName, factoryName);
    setUser(bootstrapped.user);
  }

  async function signUp(
    email: string,
    password: string,
    organizationName: string,
    factoryName: string,
  ) {
    const data = await supabaseAuth("signup", { email, password });
    let next = data as AuthSession;
    if (!next.access_token) {
      next = await supabaseAuth("token?grant_type=password", { email, password }) as AuthSession;
    }
    setSession(next);
    saveSession(next);
    await createWorkspace(organizationName, factoryName);
  }

  function signOut() {
    setSession(null);
    setUser(null);
    saveSession(null);
  }

  const value = useMemo(
    () => ({ session, user, loading, signIn, signUp, createWorkspace, signOut }),
    [session, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
