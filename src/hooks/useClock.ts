import { useEffect, useState } from "react";
import { api } from "@/services";

/** The data source's "now": real time for live data, the replay instant (advancing) for the snapshot. */
export function sourceNow() {
  return new Date(api.now).getTime();
}

/**
 * Re-renders every `interval` ms while the tab is visible, returning the
 * source time. Used for live durations and the next-show countdown.
 */
export function useClock(interval = 1000) {
  const [now, setNow] = useState(sourceNow);
  useEffect(() => {
    let id = 0;
    const start = () => {
      window.clearInterval(id);
      id = window.setInterval(() => setNow(sourceNow()), interval);
    };
    const onVis = () => (document.hidden ? window.clearInterval(id) : (setNow(sourceNow()), start()));
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [interval]);
  return now;
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d, h: pad(h), m: pad(m), s: pad(sec) };
}
