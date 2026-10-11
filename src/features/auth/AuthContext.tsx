import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface Account {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** An error from the auth API, with the form field it is about (if any). */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: "name" | "email" | "password",
    readonly code?: string,
  ) {
    super(message);
  }
}

interface AuthValue {
  /** undefined while the session is being checked. */
  user: Account | null | undefined;
  login: (email: string, password: string) => Promise<Account>;
  register: (name: string, email: string, password: string) => Promise<Account>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

async function call(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...init, headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) } });
  } catch {
    throw new AuthError("Can’t reach the server. Check your connection and try again.", undefined, "network");
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: Account | null; message?: string; field?: AuthError["field"]; error?: string } | null;
  if (!res.ok || !data?.ok) {
    const message = data?.message ?? (res.status === 404 ? "Accounts aren’t available on this server yet." : "Something went wrong. Try again.");
    throw new AuthError(message, data?.field, data?.error ?? String(res.status));
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    call("/api/auth/me").then(
      (d) => live && setUser(d.user ?? null),
      () => live && setUser(null),
    );
    return () => {
      live = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setUser(d.user!);
    return d.user!;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const d = await call("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
    setUser(d.user!);
    return d.user!;
  }, []);

  const logout = useCallback(async () => {
    await call("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
