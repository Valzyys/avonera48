import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — Avonera48` : "Avonera48 — a JKT48 fan website";
  }, [title]);
}
