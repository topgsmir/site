"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";

export function useNewOrderCount(enabled = true) {
  const [count, setCount] = useState(0);
  const markerVersion = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const requestedAtVersion = markerVersion.current;
    try {
      const response = await api.get<{ count: number }>("/orders/new-count");
      if (requestedAtVersion === markerVersion.current) setCount(response.data.count);
    } catch {
      // The orders workspace owns request errors; navigation stays usable if this optional count fails.
    }
  }, [enabled]);

  const markSeen = useCallback(async () => {
    if (!enabled) return;
    try {
      await api.post("/orders/seen");
      markerVersion.current += 1;
      setCount(0);
    } catch {
      // Keep the last server count when the marker could not be persisted.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { count, refresh, markSeen };
}
