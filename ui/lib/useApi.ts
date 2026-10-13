"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; error: unknown };

/** Load data once per `key` change; `reload()` fetches again. `key` must identify what `load` fetches. */
export function useApi<T>(load: () => Promise<T>, key: string): { state: ApiState<T>; reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let alive = true;
    loadRef.current().then(
      (data) => alive && setState({ status: "ok", data }),
      (error) => alive && setState({ status: "error", error }),
    );
    return () => {
      alive = false;
    };
  }, [key, tick]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setTick((t) => t + 1);
  }, []);

  return { state, reload };
}
