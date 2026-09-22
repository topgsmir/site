"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
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

function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function normalizePhoneInput(value: string) {
  return normalizeDigits(value).replace(/[\s().-]/g, "");
}

const OTP_LENGTH = 6;
const emptyOtp = () => Array.from({ length: OTP_LENGTH }, () => "");

type AuthCopy = {
  title: string;
  description: string;
  fullName: string;
  identifier: string;
  methodUnavailable: string;
  phoneInvalid: string;
  code: string;
  codeDigit: string;
  sendCode: string;
  verifyCode: string;
  firstPhoneHint: string;
  codeSentTo: string;
  codeExpiresIn: string;
  codeExpired: string;
  resendCode: string;
  changePhone: string;
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
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [needsName, setNeedsName] = useState(false);
  const [fullName, setFullName] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(emptyOtp);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [captchaPolicies, setCaptchaPolicies] = useState<Record<"login" | "register", boolean> | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  useEffect(() => {
    if (!challengeId) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challengeId]);

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

  async function requestCode(phoneNumber: string) {
    const otpCaptchaToken = await captchaTokenFor("otp");
    const response = await fetch(`${API_BASE}/auth/otp/request`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, ...(otpCaptchaToken ? { captchaToken: otpCaptchaToken } : {}) }) });
    const data = await response.json().catch(() => null) as { challengeId?: string; expiresAt?: string; message?: string } | null;
    if (!response.ok || !data?.challengeId) throw new Error(data?.message || copy.genericError);
    setChallengeId(data.challengeId);
    setRequestedPhone(phoneNumber);
    setCodeExpiresAt(data.expiresAt ? Date.parse(data.expiresAt) : Date.now() + 5 * 60_000);
    setNow(Date.now());
    setNeedsName(false);
    setOtpDigits(emptyOtp());
  }

  function updateOtp(index: number, rawValue: string) {
    const digits = normalizeDigits(rawValue).replace(/\D/g, "");
    setOtpDigits((current) => {
      const next = [...current];
      if (!digits) next[index] = "";
      else digits.slice(0, OTP_LENGTH - index).split("").forEach((digit, offset) => { next[index + offset] = digit; });
      return next;
    });
    if (digits) otpInputRefs.current[Math.min(index + digits.length, OTP_LENGTH - 1)]?.focus();
  }

  function handleOtpKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (otpDigits[index]) updateOtp(index, "");
      else if (index > 0) {
        updateOtp(index - 1, "");
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLDivElement>) {
    const digits = normalizeDigits(event.clipboardData.getData("text")).replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!digits) return;
    event.preventDefault();
    setOtpDigits(Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] ?? ""));
    otpInputRefs.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
  }

  async function resendCode() {
    setIsSubmitting(true);
    setError("");
    try { await requestCode(normalizedPhone); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : copy.genericError); }
    finally { setIsSubmitting(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    if (phoneMode) {
      const phoneNumber = normalizedPhone;
      try {
        if (!challengeId || phoneNumber !== requestedPhone || codeExpiresAt <= Date.now()) {
          await requestCode(phoneNumber);
        } else {
          const response = await fetch(`${API_BASE}/auth/otp/verify`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, challengeId, code: otpDigits.join(""), ...(needsName && fullName.trim() ? { fullName: fullName.trim() } : {}) }) });
          const data = await response.json().catch(() => null) as { user?: AuthUser; registrationRequired?: boolean; message?: string } | null;
          if (response.ok && data?.registrationRequired) {
            setNeedsName(true);
            return;
          }
          if (!response.ok || !data?.user) throw new Error(data?.message || copy.genericError);
          router.push(destinationFor(data.user, locale, nextPath) as Route); router.refresh();
        }
      } catch (requestError) { setError(requestError instanceof Error ? requestError.message : copy.genericError); }
      finally { setIsSubmitting(false); }
      return;
    }
    const password = String(form.get("password") ?? "");
    const submittedName = String(form.get("fullName") ?? "").trim();
    const action = needsName ? "register" : "login";
    if (captchaPolicies?.[action] && !captchaToken) { setError(copy.genericError); setIsSubmitting(false); return; }

    try {
      if (needsName && trimmedIdentifier.includes("@")) {
        if (!submittedName) return;
        const registration = await fetch(`${API_BASE}/auth/register`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: submittedName, email: trimmedIdentifier, password, ...(captchaPolicies?.register ? { captchaToken } : {}) })
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
  const normalizedPhone = normalizePhoneInput(trimmedIdentifier);
  const phoneCandidate = /^[+\d]+$/.test(normalizedPhone) && /\d/.test(normalizedPhone);
  const phoneValid = /^(?:\+98|0098|98|0)?9\d{9}$/.test(normalizedPhone);
  const phoneMode = phoneCandidate;
  const codeSecondsLeft = Math.max(0, Math.ceil((codeExpiresAt - now) / 1000));
  const otpComplete = otpDigits.every(Boolean);
  const codeTime = `${Math.floor(codeSecondsLeft / 60)}:${String(codeSecondsLeft % 60).padStart(2, "0")}`;
  const methodUnavailable = methods !== null && trimmedIdentifier.length > 0 && (
    phoneMode ? !methods.phoneOtpEnabled : !methods.emailPasswordEnabled
  );
  const captchaAction = needsName ? "register" : "login";
  const captchaRequired = !phoneMode && captchaPolicies?.[captchaAction] === true;
  const phoneStepReady = !challengeId || codeSecondsLeft === 0 || (needsName ? fullName.trim().length >= 2 : otpComplete);
  const canSubmit = methods !== null && (phoneMode || captchaPolicies !== null) && !methodUnavailable && trimmedIdentifier.length > 0 && (!phoneMode || (phoneValid && phoneStepReady)) && (!captchaRequired || captchaToken !== null);

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
                setCodeExpiresAt(0);
                setNeedsName(false);
                setFullName("");
                setOtpDigits(emptyOtp());
                setCaptchaToken(null);
                setError("");
              }}
              required
            />
          </label>
          {phoneMode ? challengeId ? <>
            <div className="auth-code-meta">
              <p>{copy.codeSentTo} <b dir="ltr">{requestedPhone}</b></p>
              <button type="button" onClick={() => { setChallengeId(""); setRequestedPhone(""); setCodeExpiresAt(0); setNeedsName(false); setFullName(""); setOtpDigits(emptyOtp()); setError(""); }}>{copy.changePhone}</button>
            </div>
            {needsName ? <>
              <p className="auth-flow-hint">{copy.firstPhoneHint}</p>
              <label>
                <span>{copy.fullName}</span>
                <input name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus required />
              </label>
            </> : <label className="auth-code-label">
              <span id="otp-label">{copy.code}</span>
              <div className="auth-code-inputs" role="group" aria-labelledby="otp-label" onPaste={handleOtpPaste} dir="ltr">
                {otpDigits.map((digit, index) => <input
                  key={index}
                  ref={(element) => { otpInputRefs.current[index] = element; }}
                  className="auth-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  pattern="[0-9]"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  value={digit}
                  aria-label={`${copy.codeDigit} ${index + 1}`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "auth-error" : undefined}
                  onChange={(event) => updateOtp(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event)}
                  onFocus={(event) => event.currentTarget.select()}
                  autoFocus={index === 0}
                  required={codeSecondsLeft > 0}
                />)}
              </div>
            </label>}
            <p className="auth-code-timer" role="status">{codeSecondsLeft ? `${copy.codeExpiresIn} ${codeTime}` : copy.codeExpired}</p>
            <button className="auth-resend" type="button" disabled={isSubmitting} onClick={() => void resendCode()}>{copy.resendCode}</button>
          </> : null : trimmedIdentifier ? <>
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
          {needsName && trimmedIdentifier.includes("@") ? <><p className="auth-flow-hint">{copy.firstEmailHint}</p><label><span>{copy.fullName}</span><input name="fullName" type="text" autoComplete="given-name" minLength={2} maxLength={100} /></label></> : null}</> : null}

          {phoneMode && !phoneValid ? <p className="auth-flow-hint" role="status">{copy.phoneInvalid}</p> : null}
          {methodUnavailable ? <p className="auth-error" role="status">{copy.methodUnavailable}</p> : null}
          {captchaRequired ? <CaptchaWidget action={captchaAction} onTokenChange={setCaptchaToken} resetSignal={captchaReset} /> : null}
          {error ? <p className="auth-error" id="auth-error" role="alert">{error}</p> : null}

          <button className="auth-submit" type="submit" disabled={isSubmitting || !canSubmit} aria-busy={isSubmitting} data-loading={isSubmitting || undefined}>
            {isSubmitting ? copy.submitting : phoneMode ? challengeId && codeSecondsLeft ? needsName ? copy.loginAction : copy.verifyCode : copy.sendCode : copy.loginAction}
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
