"use client";

import { useState } from "react";
import { loadGoghdiConfig, waitForGoghdiSdk } from "@/lib/goghdi/goghdi";
import styles from "./ContactPage.module.css";

export function ContactChat({ label, opening, unavailable }: { label: string; opening: string; unavailable: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function openChat() {
    if (state === "loading") return;
    setState("loading");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          const config = await loadGoghdiConfig();
          if (!config.enabled) throw new Error("Chat unavailable");
          return waitForGoghdiSdk();
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Chat timed out")), 16_000); })
      ]).then((sdk) => sdk.show());
      setState("idle");
    } catch {
      setState("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  return <div className={styles.chatControl}>
    <button type="button" className={styles.primary} onClick={openChat} disabled={state === "loading"} aria-describedby={state === "error" ? "chat-status" : undefined}>{state === "loading" ? opening : label}<span aria-hidden="true">↗</span></button>
    <p id="chat-status" role="status" className={styles.chatStatus}>{state === "error" ? unavailable : state === "loading" ? opening : ""}</p>
  </div>;
}
