import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE = "avn.theme";

interface ThemeValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage blocked */
  }
  // Light is the default edition; dark only when the visitor chose it.
  return "light";
}

/**
 * Day (light) / Night (dark) edition. Light is the default; an explicit
 * choice is kept in localStorage and applied before first paint by
 * index.html. "system" remains available as a preference value.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme: ResolvedTheme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.classList.add("theme-swap");
    const t = window.setTimeout(() => root.classList.remove("theme-swap"), 600);
    return () => window.clearTimeout(t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#121211" : "#f6f5f2");
  }, [theme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(STORAGE, p);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setPreference(theme === "dark" ? "light" : "dark"), [theme, setPreference]);

  const value = useMemo(() => ({ preference, theme, setPreference, toggle }), [preference, theme, setPreference, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside ThemeProvider");
  return v;
}
