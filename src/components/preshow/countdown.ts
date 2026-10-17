export type CountdownPhase = "none" | "loop" | "final" | "zero";

/** Where the countdown stands: no start time, far off, in the final stretch, or done. */
export function countdownPhase(remainingMs: number | null, finalSeconds: number): CountdownPhase {
  if (remainingMs == null) return "none";
  if (remainingMs <= 0) return "zero";
  if (remainingMs <= finalSeconds * 1000) return "final";
  return "loop";
}
