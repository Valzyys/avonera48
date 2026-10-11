import { useCallback, useEffect, useRef, useState } from "react";

export type ResourceState<T> =
  | { status: "loading"; data: T | undefined; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | undefined; error: Error };

/**
 * Minimal async loader with loading / success / error states.
 * Keeps the previous data while reloading so tables don't flash empty.
 */
export function useResource<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading", data: undefined, error: null });
  const callId = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loader = useCallback(load, deps);

  const run = useCallback(() => {
    const id = ++callId.current;
    setState((s) => ({ status: "loading", data: s.data, error: null }));
    loader().then(
      (data) => id === callId.current && setState({ status: "success", data, error: null }),
      (error: unknown) =>
        id === callId.current &&
        setState((s) => ({ status: "error", data: s.data, error: error instanceof Error ? error : new Error(String(error)) })),
    );
  }, [loader]);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
