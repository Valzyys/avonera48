import { useEffect, useRef, useState } from "react";
import type { AmAccountDetail, AmMessage } from "../../../shared/am";
import { am, AmApiError } from "./api";

/** Drive only the selected, explicitly opted-in admin workflow while visible. */
export function useAutomaticWorkflow(
  enabled: boolean,
  account: string | null,
  detail: AmAccountDetail | null,
  messages: AmMessage[],
  refresh: () => Promise<void>,
) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wake, setWake] = useState(0);
  const busy = useRef(false);
  const attempted = useRef(new Set<string>());
  const paused = useRef(new Set<string>());
  const retryAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const visible = () => { if (document.visibilityState === "visible") setWake(n => n + 1); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => { setError(null); }, [account]);
  useEffect(() => {
    const workflow = detail?.workflows[0];
    if (!enabled || !account || !workflow || detail?.account.id !== account || busy.current ||
      paused.current.has(workflow.id) || document.visibilityState !== "visible" || Date.now() < retryAt.current) return;
    let operation: "send" | "verify-and-apply";
    if (workflow.status === "awaiting_email") operation = "send";
    else if (workflow.status === "verified") operation = "verify-and-apply";
    else if (workflow.status === "awaiting_approval") {
      const sent = detail.activity.find(event => event.action === "send_approved");
      if (!sent || !messages.some(message => message.received_at && message.received_at >= sent.created_at)) return;
      operation = "verify-and-apply";
    } else return;
    const key = `${workflow.id}:${operation}:${workflow.status}:${workflow.updated_at}:${messages.map(m => m.id).join(",")}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    busy.current = true;
    setRunning(true);
    setError(null);
    void am.operation(account, workflow.id, operation, { consent: true, owns_account: true })
      .catch((failure: unknown) => {
        setError(failure instanceof Error ? failure.message : "Automatic workflow stopped. Refresh the account before continuing.");
        if (failure instanceof AmApiError && failure.status === 429) {
          retryAt.current = Date.now() + failure.retryAfterSeconds * 1000;
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            attempted.current.delete(key);
            retryAt.current = 0;
            setWake(n => n + 1);
          }, failure.retryAfterSeconds * 1000);
        } else if (!(failure instanceof AmApiError && failure.code === "magic_link_missing")) {
          paused.current.add(workflow.id);
        }
      })
      .finally(async () => {
        await refresh();
        busy.current = false;
        setRunning(false);
        setWake(n => n + 1);
      });
  }, [account, detail, enabled, messages, refresh, wake]);
  return { running, error };
}
