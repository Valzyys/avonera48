import { useSyncExternalStore } from "react";
import { onServerClock, serverOffset } from "@/utils/serverClock";

/** Milliseconds the device clock is behind the server (updated on every API response). */
export function useServerTimeOffset(): number {
  return useSyncExternalStore(onServerClock, serverOffset, () => 0);
}
