import type { RuleIcon } from "../preshow.config";

/** Line icons drawn for the pre-show: 24px grid, 2px rounded strokes. `pathLength` lets them draw on. */
const PATHS: Record<RuleIcon | "star" | "sound-on" | "sound-off" | "instagram" | "x" | "tiktok" | "youtube" | "whatsapp", string[]> = {
  "no-record": ["M3 7h12v10H3z", "M15 10.5l6-3.5v10l-6-3.5", "M2 2l20 20"],
  chat: ["M4 5h16v11H9l-5 4z", "M8 9.5h8", "M8 12.5h5"],
  "no-spam": ["M4 10v4h3l6 4V6L7 10z", "M17 9.5a3.5 3.5 0 0 1 0 5", "M2 2l20 20"],
  wifi: ["M2 8.5a15 15 0 0 1 20 0", "M5.5 12a10 10 0 0 1 13 0", "M9 15.5a5 5 0 0 1 6 0", "M12 19h0"],
  star: ["M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"],
  "sound-on": ["M4 9.5h3.5L12 6v12l-4.5-3.5H4z", "M15.5 9a4 4 0 0 1 0 6", "M18 6.5a7.5 7.5 0 0 1 0 11"],
  "sound-off": ["M4 9.5h3.5L12 6v12l-4.5-3.5H4z", "M16 9.5l5 5", "M21 9.5l-5 5"],
  instagram: ["M4 4h16v16H4z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M17 7h0"],
  x: ["M4 4l16 16", "M20 4L4 20"],
  tiktok: ["M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5", "M14 3c.5 2.5 2.5 4.5 5 4.5"],
  youtube: ["M3 7.5C3 6 4 5 5.5 5h13C20 5 21 6 21 7.5v9c0 1.5-1 2.5-2.5 2.5h-13C4 19 3 18 3 16.5z", "M10 9l5 3-5 3z"],
  whatsapp: ["M3.5 20.5l1.3-4.3A8.5 8.5 0 1 1 8 19.3z", "M9 8.5c0 3.5 3 6.5 6.5 6.5"],
};

export type PsIconName = keyof typeof PATHS;

export function PsIcon({ name, size = 24, className, draw }: { name: PsIconName; size?: number | string; className?: string; draw?: boolean }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} pathLength={draw ? 1 : undefined} className={draw ? "ps-draw" : undefined} style={draw ? { animationDelay: `calc(var(--d, 0s) + var(--o, 0s) + ${i * 0.18}s)` } : undefined} />
      ))}
    </svg>
  );
}
