"use client";

import { createPolling, type PollingState } from "@/lib/polling";
import { useEffect, useRef, useState } from "react";

export function usePaymentPolling<T>(key: string | null, check: () => Promise<T>, onResult: (result: T) => boolean) {
  const callbacks = useRef({ check, onResult });
  const controller = useRef<ReturnType<typeof createPolling<T>> | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; state: PollingState } | null>(null);
  useEffect(() => { callbacks.current = { check, onResult }; });
  useEffect(() => {
    if (!key) return;
    const polling = createPolling({
      check: () => callbacks.current.check(),
      onResult: (result) => callbacks.current.onResult(result),
      onState: (state) => setSnapshot({ key, state }),
    });
    controller.current = polling;
    return () => { polling.dispose(); controller.current = null; };
  }, [key]);
  return { state: snapshot?.key === key ? snapshot.state : "waiting" as PollingState, retry: () => controller.current?.retry() };
}
