"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { loadGoghdiConfig, openGoghdiOrderTicket } from "@/lib/goghdi/goghdi";
import type { OrderCopy } from "./OrderDetailsCopy";
import s from "./OrderDetails.module.css";

export function CustomerOrderChat({ orderId, orderItemId, available, c }: { orderId: string; orderItemId: string; available: boolean; c: OrderCopy }) {
  const hintId = useId();
  const [config, setConfig] = useState<"loading" | "enabled" | "disabled" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const lock = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadGoghdiConfig().then((value) => {
      if (mounted.current) setConfig(value.enabled ? "enabled" : "disabled");
    }).catch(() => { if (mounted.current) setConfig("error"); });
    return () => { mounted.current = false; };
  }, []);

  async function open() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const settings = await loadGoghdiConfig();
      if (!mounted.current) return;
      setConfig(settings.enabled ? "enabled" : "disabled");
      if (settings.enabled) await openGoghdiOrderTicket(orderId, orderItemId);
    } catch (cause) {
      if (mounted.current) setError(isAxiosError(cause) && cause.response?.status === 503 && !available ? c.chatSellerUnavailable : c.chatError);
    }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  const hint = config === "loading" ? c.chatLoading : config === "error" ? c.chatConfigError : config === "disabled" ? c.chatDisabled : c.chatHint;
  return <div className={s.sellerChat}>
    <p id={hintId} role="status">{hint}</p>
    <button type="button" className={`${s.primary} ${s.chatButton}`} aria-describedby={hintId} aria-busy={busy} disabled={busy || config === "loading" || config === "disabled"} onClick={() => void open()}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-5 3V7.5A4.5 4.5 0 0 1 7.5 3h8A4.5 4.5 0 0 1 20 7.5v4Z" /><path d="M7 8h9M7 12h6" /></svg>
      <span>{busy ? c.working : config === "error" ? c.retry : c.chat}</span>
    </button>
    {error ? <p className={s.error} role="alert">{error}</p> : null}
  </div>;
}
