"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { scheduleEffectTask } from "@/lib/effect-task";

export type DashboardBoard = {
  leaders: { place: number; name: string; score: string; isYou: boolean }[];
  you: { place: number | null; name: string; score: string; orderCount: number; quantity: number };
};
export type DashboardWallet = { balance: string; currency: "TOMAN" };
export type DashboardClub = { enabled: boolean; balance: number; expiringPoints: number };

export function useDashboardResource<Resource>(endpoint: string) {
  const [state, setState] = useState<{ data: Resource | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false });
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) => ({ ...current, loading: true, error: false }));
    try {
      const response = await api.get<Resource>(endpoint, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ data: response.data, loading: false, error: false });
    } catch {
      if (!controller.signal.aborted) setState((current) => ({ ...current, loading: false, error: true }));
    }
  }, [endpoint]);
  useEffect(() => scheduleEffectTask(() => {
    void reload();
    return () => request.current?.abort();
  }), [reload]);
  return { ...state, reload };
}
