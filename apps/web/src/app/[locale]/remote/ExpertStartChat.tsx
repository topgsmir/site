"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isAxiosError } from "axios";
import { DesignIcon } from "@/components/DesignIcon";
import {
  GoghdiAuthenticationRequiredError,
  loadGoghdiConfig,
  openGoghdiAgentTicket
} from "@/lib/goghdi/goghdi";
import type { Locale } from "@/lib/i18n";
import styles from "./RemotePage.module.css";

type Copy = {
  startChat: string;
  openingChat: string;
  chatUnavailable: string;
  chatError: string;
};

export function ExpertStartChat({
  sellerId,
  sellerName,
  available,
  locale,
  nextPath,
  className,
  unavailableClassName,
  errorClassName,
  c
}: {
  sellerId: string;
  sellerName: string;
  available: boolean;
  locale: Locale;
  /** Where login should return. Defaults to the remote services page. */
  nextPath?: string;
  className?: string;
  unavailableClassName?: string;
  errorClassName?: string;
  c: Copy;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function open() {
    if (lock.current || !available) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const config = await loadGoghdiConfig();
      if (!config.enabled) throw new Error("Chat unavailable");
      await openGoghdiAgentTicket(sellerId);
    } catch (cause) {
      if (cause instanceof GoghdiAuthenticationRequiredError || (isAxiosError(cause) && cause.response?.status === 401)) {
        const next = nextPath ?? `/${locale}/remote`;
        router.push(`/${locale}/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setError(isAxiosError(cause) && cause.response?.status === 503 ? c.chatUnavailable : c.chatError);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!available) {
    return <p className={unavailableClassName ?? styles.chatUnavailable}>{c.chatUnavailable}</p>;
  }

  return (
    <div className={styles.chatControl}>
      <button
        type="button"
        className={className ?? styles.profileLink}
        aria-label={`${c.startChat}: ${sellerName}`}
        aria-busy={busy}
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? c.openingChat : c.startChat}
        <DesignIcon name="headphones" />
      </button>
      {error ? <p className={errorClassName ?? styles.chatError} role="alert">{error}</p> : null}
    </div>
  );
}
