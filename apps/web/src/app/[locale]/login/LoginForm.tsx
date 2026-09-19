"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import type { AuthLoginMethods, PlatformPermission } from "@topgsm/shared-types";
import { CaptchaWidget } from "@/components/CaptchaWidget";
import { captchaTokenFor } from "@/lib/security-captcha";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type AuthCopy = {
  title: string;
  description: string;
  fullName: string;
  identifier: string;
  methodUnavailable: string;
  phoneInvalid: string;
  code: string;
  sendCode: string;
  verifyCode: string;
  firstPhoneHint: string;
  firstEmailHint: string;
  invalidCredentials: string;
  methodsError: string;
  email: string;
  password: string;
  loginAction: string;
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
        : `/${locale}/account`;

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
  if (nextPath.startsWith(`/${locale}/account`) && user.role !== "buyer") {
    return fallback;
  }

  return nextPath;
}

export function LoginForm({ locale, copy, nextPath }: LoginFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [methods, setMethods] = useState<AuthLoginMethods | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [requestedPhone, setRequestedPhone] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [captchaPolicies, setCaptchaPolicies] = useState<Record<"login" | "register", boolean> | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/login-methods", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(copy.methodsError);
        return response.json() as Promise<AuthLoginMethods>;
      })
      .then((value) => {
        if (!active) return;
        setMethods(value);
      })
      .catch(() => { if (active) setError(copy.methodsError); });
    return () => { active = false; };
  }, [copy.methodsError]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/auth/security-policy`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<Array<{ action: "login" | "register"; captchaEnabled: boolean }>>; })
      .then((rows) => { if (active) setCaptchaPolicies({ login: rows.find((row) => row.action === "login")?.captchaEnabled ?? false, register: rows.find((row) => row.action === "register")?.captchaEnabled ?? false }); })
      .catch(() => { if (active) setError(copy.methodsError); });
    return () => { active = false; };
  }, [copy.methodsError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    if (phoneMode) {
      const phoneNumber = identifier.trim();
      try {
        if (!challengeId || phoneNumber !== requestedPhone) {
          const otpCaptchaToken = await captchaTokenFor("otp");
          const response = await fetch(`${API_BASE}/auth/otp/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, ...(otpCaptchaToken ? { captchaToken: otpCaptchaToken } : {}) }) });
          const data = await response.json().catch(() => null) as { challengeId?: string; message?: string } | null;
          if (!response.ok || !data?.challengeId) throw new Error(data?.message || copy.genericError);
          setChallengeId(data.challengeId); setRequestedPhone(phoneNumber);
        } else {
          const response = await fetch(`${API_BASE}/auth/otp/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, challengeId, code: String(form.get("code") ?? ""), ...(String(form.get("fullName") ?? "").trim() ? { fullName: String(form.get("fullName")) } : {}), ...(String(form.get("email") ?? "").trim() ? { email: String(form.get("email")) } : {}) }) });
          const data = await response.json().catch(() => null) as { user?: AuthUser; message?: string } | null;
          if (!response.ok || !data?.user) throw new Error(data?.message || copy.genericError);
          router.push(destinationFor(data.user, locale, nextPath) as Route); router.refresh();
        }
      } catch (requestError) { setError(requestError instanceof Error ? requestError.message : copy.genericError); }
      finally { setIsSubmitting(false); }
      return;
    }
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const action = needsName ? "register" : "login";
    if (captchaPolicies?.[action] && !captchaToken) { setError(copy.genericError); setIsSubmitting(false); return; }

    try {
      if (needsName && trimmedIdentifier.includes("@")) {
        if (!fullName) return;
        const registration = await fetch(`${API_BASE}/auth/register`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, email: trimmedIdentifier, password, ...(captchaPolicies?.register ? { captchaToken } : {}) })
        });
        const registered = await registration.json().catch(() => null) as { user?: AuthUser; message?: string | string[] } | null;
        if (registration.status === 409) throw new Error(copy.invalidCredentials);
        if (!registration.ok || !registered?.user) throw new Error((Array.isArray(registered?.message) ? registered.message[0] : registered?.message) || copy.genericError);
        router.push(destinationFor(registered.user, locale, nextPath) as Route); router.refresh(); return;
      }
      const response = await fetch(
        `${API_BASE}/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: trimmedIdentifier, password, ...(captchaPolicies?.login ? { captchaToken } : {}) })
        }
      );
      const data = (await response.json().catch(() => null)) as
        | { user?: AuthUser; message?: string | string[] }
        | null;

      if (response.status === 401 && trimmedIdentifier.includes("@")) {
        setNeedsName(true);
        return;
      }
      if (!response.ok || !data?.user) {
        const message = Array.isArray(data?.message)
          ? data.message[0]
          : data?.message;
        throw new Error(response.status === 401 ? copy.invalidCredentials : message || copy.genericError);
      }

      router.push(destinationFor(data.user, locale, nextPath) as Route);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : copy.genericError
      );
    } finally {
      setIsSubmitting(false);
      setCaptchaToken(null);
      setCaptchaReset((value) => value + 1);
    }
  }

  const trimmedIdentifier = identifier.trim();
  const phoneCandidate = /^[+\d]+$/.test(trimmedIdentifier) && trimmedIdentifier.length > 0;
  const phoneValid = /^(?:\+98|0098|98|0)?9\d{9}$/.test(trimmedIdentifier);
  const phoneMode = phoneCandidate;
  const methodUnavailable = methods !== null && trimmedIdentifier.length > 0 && (
    phoneMode ? !methods.phoneOtpEnabled : !methods.emailPasswordEnabled
  );
  const captchaAction = needsName ? "register" : "login";
  const captchaRequired = !phoneMode && captchaPolicies?.[captchaAction] === true;
  const canSubmit = methods !== null && (phoneMode || captchaPolicies !== null) && !methodUnavailable && trimmedIdentifier.length > 0 && (!phoneMode || phoneValid) && (!captchaRequired || captchaToken !== null);

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="auth-brand" href={`/${locale}`} aria-label="Top GSM home">
          <span dir="ltr" translate="no">topgsm.</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">Top GSM account</p>
          <h1 id="auth-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>{copy.identifier}</span>
            <input
              name="identifier"
              value={identifier}
              type="text"
              inputMode="text"
              autoComplete="username"
              maxLength={254}
              dir="ltr"
              onChange={(event) => {
                setIdentifier(event.target.value);
                setChallengeId("");
                setRequestedPhone("");
                setNeedsName(false);
                setCaptchaToken(null);
                setError("");
              }}
              required
            />
          </label>
          {phoneMode ? challengeId ? <><label><span>{copy.code}</span><input name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label><p className="auth-flow-hint">{copy.firstPhoneHint}</p><label><span>{copy.fullName}</span><input name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} /></label><label><span>{copy.email}</span><input name="email" type="email" autoComplete="email" maxLength={254} /></label></> : null : trimmedIdentifier ? <>
          <label>
            <span>{copy.password}</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={1}
              maxLength={128}
              required
            />
          </label>
          {needsName && trimmedIdentifier.includes("@") ? <><p className="auth-flow-hint">{copy.firstEmailHint}</p><label><span>{copy.fullName}</span><input name="fullName" type="text" autoComplete="name" minLength={2} maxLength={100} /></label></> : null}</> : null}

          {phoneMode && !phoneValid ? <p className="auth-flow-hint" role="status">{copy.phoneInvalid}</p> : null}
          {methodUnavailable ? <p className="auth-error" role="status">{copy.methodUnavailable}</p> : null}
          {captchaRequired ? <CaptchaWidget action={captchaAction} onTokenChange={setCaptchaToken} resetSignal={captchaReset} /> : null}
          {error ? <p className="auth-error" role="alert">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? copy.submitting : phoneMode ? challengeId ? copy.verifyCode : copy.sendCode : copy.loginAction}
          </button>
        </form>
        <Link className="auth-back" href={`/${locale}`}>{copy.backHome}</Link>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <Image src="/images/repair-studio.png" alt="" fill sizes="50vw" priority />
<div><small>TOP GSM</small><strong>{locale === "fa" ? "همراه شما، در هر قدم تعمیر." : locale === "ar" ? "معك في كل خطوة من الصيانة." : "A little support. A better repair."}</strong></div>
      </aside>
    </main>
  );
}
