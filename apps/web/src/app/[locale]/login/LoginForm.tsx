"use client";

import { FormEvent, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import type { PlatformPermission } from "@topgsm/shared-types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type AuthCopy = {
  title: string;
  registerTitle: string;
  description: string;
  registerDescription: string;
  fullName: string;
  identifier: string;
  email: string;
  password: string;
  loginAction: string;
  registerAction: string;
  noAccount: string;
  hasAccount: string;
  switchToRegister: string;
  switchToLogin: string;
  submitting: string;
  genericError: string;
  backHome: string;
};

type AuthUser = {
  role: "platform-admin" | "platform-staff" | "seller-admin" | "seller-staff" | "buyer";
  platformPermissions?: PlatformPermission[];
};

type LoginFormProps = {
  locale: Locale;
  copy: AuthCopy;
  nextPath?: string;
};

function destinationFor(user: AuthUser, locale: Locale, nextPath?: string) {
  const fallback =
    user.role === "platform-admin"
      ? `/${locale}/admin`
      : user.role === "platform-staff"
        ? user.platformPermissions?.includes("blog_manage")
          ? `/${locale}/admin/blog`
          : `/${locale}/admin`
      : user.role === "seller-admin" || user.role === "seller-staff"
        ? `/${locale}/seller-dashboard`
        : `/${locale}`;

  if (!nextPath?.startsWith(`/${locale}/`) || nextPath.includes("://")) {
    return fallback;
  }
  if (nextPath.startsWith(`/${locale}/admin`) && !["platform-admin", "platform-staff"].includes(user.role)) {
    return fallback;
  }
  if (
    nextPath.startsWith(`/${locale}/seller-dashboard`) &&
    !["platform-admin", "platform-staff", "seller-admin", "seller-staff"].includes(user.role)
  ) {
    return fallback;
  }

  return nextPath;
}

export function LoginForm({ locale, copy, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      ...(isRegistering ? { fullName: String(form.get("fullName") ?? "") } : {}),
      ...(isRegistering
        ? { email: String(form.get("email") ?? "") }
        : { identifier: String(form.get("identifier") ?? "") }),
      password: String(form.get("password") ?? "")
    };

    try {
      const response = await fetch(
        `${API_BASE}/auth/${isRegistering ? "register" : "login"}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = (await response.json().catch(() => null)) as
        | { user?: AuthUser; message?: string | string[] }
        | null;

      if (!response.ok || !data?.user) {
        const message = Array.isArray(data?.message)
          ? data.message[0]
          : data?.message;
        throw new Error(message || copy.genericError);
      }

      router.push(destinationFor(data.user, locale, nextPath) as Route);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : copy.genericError
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode() {
    setIsRegistering((value) => !value);
    setError("");
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-brand" href={`/${locale}`} aria-label="Top GSM home">
          <span>TOP</span> GSM
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">Top GSM account</p>
          <h1 id="auth-title">
            {isRegistering ? copy.registerTitle : copy.title}
          </h1>
          <p>
            {isRegistering ? copy.registerDescription : copy.description}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {isRegistering ? (
            <label>
              <span>{copy.fullName}</span>
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
          ) : null}
          <label>
            <span>{isRegistering ? copy.email : copy.identifier}</span>
            <input
              name={isRegistering ? "email" : "identifier"}
              type={isRegistering ? "email" : "text"}
              inputMode={isRegistering ? "email" : "text"}
              autoComplete={isRegistering ? "email" : "username"}
              maxLength={254}
              required
            />
          </label>
          <label>
            <span>{copy.password}</span>
            <input
              name="password"
              type="password"
              autoComplete={isRegistering ? "new-password" : "current-password"}
              minLength={isRegistering ? 8 : 1}
              maxLength={128}
              required
            />
          </label>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? copy.submitting
              : isRegistering
                ? copy.registerAction
                : copy.loginAction}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering ? copy.hasAccount : copy.noAccount}{" "}
          <button type="button" onClick={switchMode}>
            {isRegistering ? copy.switchToLogin : copy.switchToRegister}
          </button>
        </p>
        <Link className="auth-back" href={`/${locale}`}>{copy.backHome}</Link>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <span className="auth-orbit auth-orbit-one" />
        <span className="auth-orbit auth-orbit-two" />
        <div><small>TOP GSM</small><strong>Access<br />secured.</strong></div>
      </aside>
    </main>
  );
}
