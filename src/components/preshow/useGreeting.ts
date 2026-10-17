import { useEffect, useState } from "react";
import { serverNow } from "@/utils/serverClock";
import { wibHour } from "./format";

export type Greeting = "pagi" | "siang" | "sore" | "malam";

/** 04–10 pagi, 11–14 siang, 15–17 sore, 18–03 malam (WIB). */
export function greetingAt(d: Date): Greeting {
  const h = wibHour(d);
  if (h >= 4 && h < 11) return "pagi";
  if (h >= 11 && h < 15) return "siang";
  if (h >= 15 && h < 18) return "sore";
  return "malam";
}

/** The greeting for the current WIB hour, re-checked every minute. */
export function useGreeting(): Greeting {
  const [g, setG] = useState(() => greetingAt(new Date(serverNow())));
  useEffect(() => {
    const t = window.setInterval(() => setG(greetingAt(new Date(serverNow()))), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return g;
}
