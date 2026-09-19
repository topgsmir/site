"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";

type Challenge = { id: string; nonce: string; difficulty: number; expiresAt: string };

function hasLeadingZeroBits(hash: Uint8Array, difficulty: number) {
  const wholeBytes = Math.floor(difficulty / 8);
  for (let index = 0; index < wholeBytes; index++) if (hash[index] !== 0) return false;
  const remainingBits = difficulty % 8;
  return !remainingBits || (hash[wholeBytes] >> (8 - remainingBits)) === 0;
}

/** Self-hosted proof of work challenge. Submit each resulting token only once. */
export function CaptchaWidget({
  action,
  onTokenChange,
  resetSignal
}: {
  action: string;
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"working" | "ready" | "error">("working");
  const onTokenChangeRef = useRef(onTokenChange);
  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const abort = new AbortController();
    onTokenChangeRef.current(null);
    setStatus("working");

    async function solve() {
      try {
        const response = await api.post<Challenge>("/captcha/challenge", { action }, { signal: abort.signal });
        const challenge = response.data;
        if (!challenge || !Number.isInteger(challenge.difficulty) || challenge.difficulty < 1 || challenge.difficulty > 24) {
          throw new Error("Invalid challenge");
        }
        const encoder = new TextEncoder();
        for (let solution = 0; solution <= 0xffffffff && active; solution++) {
          const input = encoder.encode(`${challenge.id}:${challenge.nonce}:${solution}`);
          const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
          if (!hasLeadingZeroBits(digest, challenge.difficulty)) continue;
          if (!active || Date.now() >= Date.parse(challenge.expiresAt)) break;
          onTokenChangeRef.current(`${challenge.id}.${solution}`);
          setStatus("ready");
          expiryTimer = setTimeout(() => {
            onTokenChangeRef.current(null);
            setStatus("error");
          }, Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
          return;
        }
        if (active) throw new Error("Challenge expired");
      } catch {
        if (active) {
          onTokenChangeRef.current(null);
          setStatus("error");
        }
      }
    }

    void solve();
    return () => {
      active = false;
      abort.abort();
      if (expiryTimer) clearTimeout(expiryTimer);
      onTokenChangeRef.current(null);
    };
  }, [action, resetSignal, attempt]);

  return (
    <div aria-live="polite">
      {status === "working" && <span>Checking your browser…</span>}
      {status === "ready" && <span>Browser check complete</span>}
      {status === "error" && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry browser check
        </button>
      )}
    </div>
  );
}
