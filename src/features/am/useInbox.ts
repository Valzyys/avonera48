import { useCallback, useEffect, useRef, useState } from "react";
import type { AmAccountDetail, AmMessage } from "../../../shared/am";
import { ApiError } from "@/features/members/api";
import { am } from "./api";

export function useInbox(account: string | null, enabled: boolean) {
  const [messages, setMessages] = useState<AmMessage[]>([]);
  const [detail, setDetail] = useState<AmAccountDetail | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentAccount = useRef(account);
  currentAccount.current = account;
  const olderMessages = useRef(false);
  const olderActivity = useRef(false);
  const [retryDelay, setRetryDelay] = useState(5000);
  const [moreBusy, setMoreBusy] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    olderMessages.current = false;
    olderActivity.current = false;
    setMessages([]);
    setDetail(null);
    setCursor(null);
    setError(null);
    setLastSync(null);
  }, [account]);
  useEffect(() => {
    if (!account) {
      refreshRef.current = async () => {};
      return;
    }
    let disposed = false;
    let running = false;
    let failures = 0;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    const mergeDetail = (info: AmAccountDetail) =>
      setDetail((old) =>
        old?.account.id === info.account.id
          ? {
              ...info,
              activity: [
                ...new Map(
                  [...info.activity, ...old.activity].map((a) => [a.id, a]),
                ).values(),
              ].sort(
                (a, b) =>
                  b.created_at.localeCompare(a.created_at) ||
                  b.id.localeCompare(a.id),
              ),
              activity_next_cursor: olderActivity.current
                ? old.activity_next_cursor
                : info.activity_next_cursor,
            }
          : info,
      );
    const schedule = () => {
      window.clearTimeout(timer);
      if (!disposed && enabled && document.visibilityState === "visible") {
        const delay = Math.min(60000, 5000 * 2 ** failures);
        setRetryDelay(delay);
        timer = window.setTimeout(() => void load(true), delay);
      }
    };
    const load = async (sync: boolean) => {
      if (disposed || running || document.visibilityState !== "visible") return;
      running = true;
      controller = new AbortController();
      setBusy(true);
      try {
        // Retained metadata remains viewable even when provider sync is unavailable.
        const [list, info] = await Promise.all([
          am.messages(account, null, controller.signal),
          am.account(account, null, controller.signal),
        ]);
        if (disposed) return;
        mergeDetail(info);
        if (!olderMessages.current) setCursor(list.next_cursor);
        setMessages((old) =>
          [
            ...new Map([...old, ...list.items].map((m) => [m.id, m])).values(),
          ].sort(
            (a, b) =>
              (b.received_at ?? "").localeCompare(a.received_at ?? "") ||
              b.id.localeCompare(a.id),
          ),
        );
        if (sync && enabled) {
          await am.sync(account, controller.signal);
          const [updated, accountInfo] = await Promise.all([
            am.messages(account, null, controller.signal),
            am.account(account, null, controller.signal),
          ]);
          if (disposed) return;
          setMessages((old) =>
            [
              ...new Map(
                [...old, ...updated.items].map((m) => [m.id, m]),
              ).values(),
            ].sort(
              (a, b) =>
                (b.received_at ?? "").localeCompare(a.received_at ?? "") ||
                b.id.localeCompare(a.id),
            ),
          );
          if (!olderMessages.current) setCursor(updated.next_cursor);
          mergeDetail(accountInfo);
          setLastSync(new Date());
        }
        if (!disposed) {
          setError(null);
          failures = 0;
        }
      } catch (e) {
        if (
          !disposed &&
          !(e instanceof DOMException && e.name === "AbortError")
        ) {
          setError(e instanceof Error ? e.message : "Could not sync inbox.");
          failures = Math.min(failures + 1, 4);
          if (e instanceof ApiError && [401, 403, 503].includes(e.status))
            failures = 4;
        }
      } finally {
        running = false;
        if (!disposed) {
          setBusy(false);
          schedule();
        }
      }
    };
    const visibility = () => {
      const visible = document.visibilityState === "visible";
      setPolling(visible && enabled);
      if (visible) void load(true);
      else {
        window.clearTimeout(timer);
        controller?.abort();
      }
    };
    refreshRef.current = () => load(true);
    setPolling(document.visibilityState === "visible" && enabled);
    void load(true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller?.abort();
      setPolling(false);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [account, enabled, version]);
  const loadMore = useCallback(async () => {
    if (!account || !cursor || moreBusy) return;
    const snapshot = account;
    setMoreBusy(true);
    try {
      const list = await am.messages(snapshot, cursor);
      if (currentAccount.current !== snapshot) return;
      olderMessages.current = true;
      setMessages((old) => [
        ...new Map([...old, ...list.items].map((m) => [m.id, m])).values(),
      ]);
      setCursor(list.next_cursor);
    } finally {
      setMoreBusy(false);
    }
  }, [account, cursor, moreBusy]);
  const moreActivity = useCallback(async () => {
    if (!account || !detail?.activity_next_cursor || moreBusy) return;
    const snapshot = account;
    setMoreBusy(true);
    try {
      const result = await am.account(snapshot, detail.activity_next_cursor);
      if (currentAccount.current !== snapshot) return;
      olderActivity.current = true;
      setDetail((old) =>
        old
          ? {
              ...old,
              activity: [
                ...new Map(
                  [...old.activity, ...result.activity].map((a) => [a.id, a]),
                ).values(),
              ],
              activity_next_cursor: result.activity_next_cursor,
            }
          : old,
      );
    } finally {
      setMoreBusy(false);
    }
  }, [account, detail?.activity_next_cursor, moreBusy]);
  return {
    messages,
    detail,
    error,
    polling,
    busy,
    lastSync,
    cursor,
    refresh,
    loadMore,
    reload,
    moreActivity,
    moreBusy,
    retryDelay,
  };
}
