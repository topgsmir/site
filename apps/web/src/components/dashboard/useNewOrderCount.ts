"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export function useNewOrderCount(enabled = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await api.get<{ count: number }>("/orders/new-count");
      setCount(response.data.count);
    } catch {
      // The orders workspace owns request errors; navigation stays usable if this optional count fails.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { count, refresh };
}
