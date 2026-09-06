"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { api } from "@/lib/api/client";

export function LogoutButton({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setIsLoggingOut(true);
    setError("");

    try {
      await api.post("/auth/logout");
      router.replace(`/${locale}/login`);
      router.refresh();
    } catch {
      setError(t(locale, "auth.logoutError"));
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="logout-control">
      <button
        className="logout-button"
        type="button"
        onClick={() => void logout()}
        disabled={isLoggingOut}
        aria-label={t(locale, "auth.logoutAction")}
      >
        <LogoutIcon />
        <span>
          {isLoggingOut
            ? t(locale, "auth.loggingOut")
            : t(locale, "auth.logoutAction")}
        </span>
      </button>
      {error ? <span className="logout-error" role="alert">{error}</span> : null}
    </div>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 4H4.8A1.8 1.8 0 0 0 3 5.8v8.4A1.8 1.8 0 0 0 4.8 16H8M12.5 6.5 16 10l-3.5 3.5M7 10h9" />
    </svg>
  );
}
