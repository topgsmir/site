"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { formatCurrencyAmount } from "@/lib/currency";
import { safePaymentHref } from "@/lib/safe-navigation";
import type { Locale } from "@/lib/i18n";
import styles from "./WalletPanel.module.css";

type Balance = { balance: string; currency: "TOMAN"; withdrawalsEnabled: boolean };
type Entry = { id: string; amount: string; balanceAfter: string; kind: string; reason: string; referenceType: string; referenceId: string; createdAt: string };
type Page = { items: Entry[]; nextCursor: string | null };
type Method = { code: string; name: string };

const COPY = {
  fa: { balance: "موجودی کیف پول", unit: "تومان", topup: "شارژ کیف پول", amount: "مبلغ شارژ (تومان)", provider: "درگاه پرداخت", pay: "ادامه به درگاه", transactions: "تراکنش‌ها", more: "نمایش بیشتر", empty: "هنوز تراکنشی ثبت نشده است.", loading: "در حال دریافت کیف پول…", error: "اطلاعات کیف پول دریافت نشد. دوباره تلاش کنید.", noMethod: "درگاه شارژ فعالی وجود ندارد.", retry: "تلاش دوباره", withdrawal: "برداشت در حال حاضر فعال نیست." },
  en: { balance: "Wallet balance", unit: "Toman", topup: "Add funds", amount: "Top-up amount (Toman)", provider: "Payment provider", pay: "Continue to payment", transactions: "Transactions", more: "Show more", empty: "No wallet transactions yet.", loading: "Loading wallet…", error: "Could not load wallet details. Try again.", noMethod: "No top-up provider is available.", retry: "Try again", withdrawal: "Withdrawals are currently unavailable." },
  ar: { balance: "رصيد المحفظة", unit: "تومان", topup: "شحن المحفظة", amount: "مبلغ الشحن (تومان)", provider: "بوابة الدفع", pay: "متابعة الدفع", transactions: "المعاملات", more: "عرض المزيد", empty: "لا توجد معاملات بعد.", loading: "جارٍ تحميل المحفظة…", error: "تعذر تحميل المحفظة. حاول مجددًا.", noMethod: "لا توجد بوابة شحن متاحة.", retry: "حاول مجددًا", withdrawal: "السحب غير متاح حاليًا." }
} as const;

export function WalletPanel({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [balance, setBalance] = useState<Balance | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [page, setPage] = useState<Page>({ items: [], nextCursor: null });
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [account, history, available] = await Promise.all([
        api.get<Balance>("/wallet"), api.get<Page>("/wallet/transactions"), api.get<Method[]>("/wallet/topup-methods")
      ]);
      setBalance(account.data);
      setPage(history.data);
      setMethods(available.data);
      setProvider((current) => available.data.some((method) => method.code === current) ? current : available.data[0]?.code ?? "");
      setError("");
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error]);

  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);

  async function loadMore() {
    if (!page.nextCursor || busy) return;
    setBusy(true);
    try {
      const response = await api.get<Page>("/wallet/transactions", { params: { cursor: page.nextCursor } });
      setPage((current) => ({ items: [...current.items, ...response.data.items], nextCursor: response.data.nextCursor }));
    } catch { setError(c.error); }
    finally { setBusy(false); }
  }

  async function topup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[1-9]\d{3,8}$/.test(amount) || Number(amount) > 100000000 || !provider) return;
    setBusy(true); setError("");
    try {
      const response = await api.post<{ status: string; paymentUrl?: string }>("/wallet/topups", { amount, provider }, { headers: { "Idempotency-Key": key.current } });
      if (response.data.status === "succeeded") {
        key.current = crypto.randomUUID();
        await load();
        setBusy(false);
        return;
      }
      const destination = response.data.paymentUrl && safePaymentHref(response.data.paymentUrl, locale);
      if (!destination) throw new Error("Invalid payment destination");
      key.current = crypto.randomUUID();
      window.location.assign(destination);
    } catch { setError(c.error); setBusy(false); }
  }

  return <div className={styles.wallet} aria-busy={loading || busy}>
    {error ? <div className={styles.error} role="alert">{error} <button type="button" onClick={() => void load()}>{c.retry}</button></div> : null}
    <section className={styles.summary} aria-label={c.balance}>
      <div><span>{c.balance}</span><strong>{balance ? formatCurrencyAmount(balance.balance, "TOMAN", locale) : loading ? c.loading : "—"} <small>{c.unit}</small></strong></div>
      <p>{c.withdrawal}</p>
    </section>
    <section className={styles.section} aria-labelledby="wallet-topup-title"><h2 id="wallet-topup-title">{c.topup}</h2>
      {methods.length ? <form className={styles.form} onSubmit={(event) => void topup(event)}><label>{c.amount}<input type="text" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} pattern="[1-9][0-9]{3,8}" required /></label><label>{c.provider}<select value={provider} onChange={(event) => setProvider(event.target.value)}>{methods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label><button type="submit" disabled={busy}>{c.pay}</button></form> : !loading ? <p>{c.noMethod}</p> : null}
    </section>
    <section className={styles.section} aria-labelledby="wallet-transactions-title"><h2 id="wallet-transactions-title">{c.transactions}</h2>
      <div className={styles.list}>{page.items.map((entry) => <div className={styles.row} key={entry.id}><div><strong>{entry.reason}</strong><small>{new Date(entry.createdAt).toLocaleString(locale)} · {entry.referenceType} <bdi>{entry.referenceId}</bdi></small></div><div className={entry.amount.startsWith("-") ? styles.debit : styles.credit}><strong><bdi>{entry.amount.startsWith("-") ? "" : "+"}{formatCurrencyAmount(entry.amount, "TOMAN", locale)}</bdi> {c.unit}</strong><small>{formatCurrencyAmount(entry.balanceAfter, "TOMAN", locale)} {c.unit}</small></div></div>)}</div>
      {!loading && !page.items.length ? <p className={styles.empty}>{c.empty}</p> : null}
      {page.nextCursor ? <button className={styles.more} type="button" disabled={busy} onClick={() => void loadMore()}>{c.more}</button> : null}
    </section>
  </div>;
}
