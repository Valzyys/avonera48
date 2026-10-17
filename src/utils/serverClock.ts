/**
 * The server's clock, as seen through the `Date` header of our own API
 * responses. Countdowns read `serverNow()` so a device clock that is minutes
 * off doesn't move the show. `Date` has one-second resolution, so each sample
 * takes the middle of that second and half the round trip; the sample with
 * the shortest round trip wins.
 */

let offset = 0;
let bestRtt = Infinity;
let samples = 0;
const listeners = new Set<() => void>();

export function noteServerDate(dateHeader: string | null, sentAt: number, receivedAt: number) {
  if (!dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  const rtt = Math.max(0, receivedAt - sentAt);
  // Older, slower samples age out so a corrected device clock is picked up.
  if (rtt > bestRtt * 1.5 && samples > 0 && ++samples % 10 !== 0) return;
  bestRtt = Math.min(bestRtt, rtt);
  samples++;
  offset = server + 500 - (sentAt + rtt / 2);
  listeners.forEach((l) => l());
}

/** Milliseconds to add to Date.now() to get the server's time. */
export const serverOffset = () => offset;
export const serverNow = () => Date.now() + offset;

export function onServerClock(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
