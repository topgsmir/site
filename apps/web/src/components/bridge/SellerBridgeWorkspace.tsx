"use client";

import type { BridgeConnectionSummary, BridgeGrantSummary } from "@topgsm/shared-types";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./BridgeWorkspace.module.css";

type BridgeOrder = {
  id: string;
  orderId: string;
  productTitle: string;
  serviceName: string;
  quantity: number;
  mode: "automatic" | "manual";
  status: string;
  fields: { fields?: Record<string, string> };
  result: unknown;
  errorCode: string | null;
  mayRetry: boolean;
};

const COPY = {
  en: {
    back: "Seller dashboard", brand: "Bridge services", title: "Your upstream accounts.", intro: "Connect credentials you own, synchronize their services, then use only the services approved by the platform.",
    connections: "Connections", connectionsHelp: "Credentials are encrypted and are never displayed again.", add: "Add connection", name: "Connection name", provider: "Provider", url: "HTTPS provider URL", username: "API username", apiKey: "API key", save: "Save connection", saving: "Saving…", test: "Test", sync: "Synchronize", deactivate: "Deactivate", lastSync: "Last synchronized", never: "Never", noConnections: "No upstream accounts are connected yet.",
    grants: "Granted services", grantsHelp: "One grant can power several simple or variable products.", create: "Create product", fields: "Buyer fields", noGrants: "No services have been granted yet. Synchronize a connection, then ask an administrator to activate a service.",
    orders: "Bridge orders", ordersHelp: "Manual and failed work stays here until it is delivered, retried, or refunded.", complete: "Publish result", retry: "Retry once", result: "Delivery result", noOrders: "No Bridge orders yet.", refresh: "Refresh", error: "The request failed. Review the details and try again.", saved: "Connection saved.", done: "Action completed."
  },
  fa: {
    back: "داشبورد فروشنده", brand: "سرویس‌های Bridge", title: "حساب‌های بالادستی شما.", intro: "اطلاعات حسابی را که مالک آن هستید متصل کنید، سرویس‌ها را همگام کنید و فقط از سرویس‌های تأییدشده پلتفرم استفاده کنید.",
    connections: "اتصال‌ها", connectionsHelp: "اطلاعات ورود رمزنگاری می‌شود و دوباره نمایش داده نخواهد شد.", add: "افزودن اتصال", name: "نام اتصال", provider: "ارائه‌دهنده", url: "نشانی HTTPS ارائه‌دهنده", username: "نام کاربری API", apiKey: "کلید API", save: "ذخیره اتصال", saving: "در حال ذخیره…", test: "آزمایش", sync: "همگام‌سازی", deactivate: "غیرفعال‌سازی", lastSync: "آخرین همگام‌سازی", never: "هرگز", noConnections: "هنوز حساب بالادستی متصل نشده است.",
    grants: "سرویس‌های مجاز", grantsHelp: "هر مجوز می‌تواند برای چند محصول ساده یا متغیر استفاده شود.", create: "ساخت محصول", fields: "فیلدهای خریدار", noGrants: "هنوز سرویسی تأیید نشده است. اتصال را همگام کنید و از مدیر بخواهید سرویس را فعال کند.",
    orders: "سفارش‌های Bridge", ordersHelp: "سفارش‌های دستی یا ناموفق تا زمان تحویل، تلاش دوباره یا بازپرداخت اینجا می‌مانند.", complete: "ثبت نتیجه", retry: "یک تلاش دوباره", result: "نتیجه تحویل", noOrders: "هنوز سفارش Bridge ندارید.", refresh: "تازه‌سازی", error: "درخواست انجام نشد. جزئیات را بررسی و دوباره تلاش کنید.", saved: "اتصال ذخیره شد.", done: "عملیات انجام شد."
  },
  ar: {
    back: "لوحة البائع", brand: "خدمات Bridge", title: "حساباتك لدى المورّد.", intro: "اربط بيانات الحساب الذي تملكه، زامن خدماته، ثم استخدم فقط الخدمات التي وافقت عليها المنصة.",
    connections: "الاتصالات", connectionsHelp: "تُشفّر بيانات الدخول ولا تُعرض مرة أخرى.", add: "إضافة اتصال", name: "اسم الاتصال", provider: "المزوّد", url: "رابط HTTPS للمزوّد", username: "اسم مستخدم API", apiKey: "مفتاح API", save: "حفظ الاتصال", saving: "جارٍ الحفظ…", test: "اختبار", sync: "مزامنة", deactivate: "تعطيل", lastSync: "آخر مزامنة", never: "أبداً", noConnections: "لا توجد حسابات مورّد متصلة بعد.",
    grants: "الخدمات الممنوحة", grantsHelp: "يمكن لمنحة واحدة تشغيل عدة منتجات بسيطة أو متغيرة.", create: "إنشاء منتج", fields: "حقول المشتري", noGrants: "لم تُمنح أي خدمة بعد. زامن اتصالاً ثم اطلب من المدير تفعيل الخدمة.",
    orders: "طلبات Bridge", ordersHelp: "تبقى الطلبات اليدوية والفاشلة هنا حتى التسليم أو إعادة المحاولة أو الاسترداد.", complete: "نشر النتيجة", retry: "إعادة محاولة واحدة", result: "نتيجة التسليم", noOrders: "لا توجد طلبات Bridge بعد.", refresh: "تحديث", error: "تعذر تنفيذ الطلب. راجع التفاصيل وحاول مجدداً.", saved: "تم حفظ الاتصال.", done: "اكتملت العملية."
  }
} as const;

export function SellerBridgeWorkspace({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [connections, setConnections] = useState<BridgeConnectionSummary[]>([]);
  const [grants, setGrants] = useState<BridgeGrantSummary[]>([]);
  const [orders, setOrders] = useState<BridgeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [connectionResponse, grantResponse, orderResponse] = await Promise.all([
        api.get<BridgeConnectionSummary[]>("/bridge/connections"),
        api.get<BridgeGrantSummary[]>("/bridge/grants"),
        api.get<BridgeOrder[]>("/bridge/orders")
      ]);
      setConnections(connectionResponse.data);
      setGrants(grantResponse.data);
      setOrders(orderResponse.data);
    } catch { setError(c.error); }
    finally { setLoading(false); }
  }, [c.error]);

  useEffect(() => { void load(); }, [load]);

  async function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("create"); setError(""); setMessage("");
    try {
      await api.post("/bridge/connections", Object.fromEntries(form));
      event.currentTarget.reset();
      setMessage(c.saved);
      await load();
    } catch { setError(c.error); }
    finally { setBusy(""); }
  }

  async function connectionAction(id: string, action: "test" | "synchronize" | "deactivate") {
    setBusy(`${id}:${action}`); setError(""); setMessage("");
    try {
      if (action === "deactivate") await api.delete(`/bridge/connections/${id}`);
      else await api.post(`/bridge/connections/${id}/${action}`);
      setMessage(c.done); await load();
    } catch { setError(c.error); }
    finally { setBusy(""); }
  }

  async function orderAction(id: string, action: "complete" | "retry") {
    setBusy(`${id}:${action}`); setError(""); setMessage("");
    try {
      if (action === "complete") await api.post(`/bridge/orders/${id}/complete`, { result: results[id] ?? "" });
      else await api.post(`/bridge/orders/${id}/retry`);
      setMessage(c.done); await load();
    } catch { setError(c.error); }
    finally { setBusy(""); }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.brand}>{c.brand}</p><h1>{c.title}</h1></div>
        <div><p>{c.intro}</p><Link className={styles.link} href={`/${locale}/seller-dashboard`}>{c.back}</Link></div>
      </header>
      <main className={styles.main}>
        <section className={styles.section}>
          <div className={styles.sectionHead}><div><h2>{c.connections}</h2><p>{c.connectionsHelp}</p></div><button className={styles.buttonQuiet} onClick={() => void load()} disabled={loading}>{c.refresh}</button></div>
          <form className={styles.form} onSubmit={createConnection}>
            <h3>{c.add}</h3>
            <div className={styles.formGrid}>
              <label className={styles.field}><span>{c.name}</span><input name="name" required maxLength={100} /><small>&nbsp;</small></label>
              <label className={styles.field}><span>{c.provider}</span><select name="provider" defaultValue="dhru_legacy"><option value="dhru_legacy">Legacy Dhru</option><option value="dhru_new">New Dhru</option><option value="webx">WebX</option></select><small>&nbsp;</small></label>
              <label className={styles.field}><span>{c.url}</span><input name="baseUrl" type="url" required placeholder="https://provider.example" maxLength={500} /><small>HTTPS only</small></label>
              <label className={styles.field}><span>{c.username}</span><input name="username" autoComplete="off" required maxLength={255} /><small>&nbsp;</small></label>
              <label className={styles.field}><span>{c.apiKey}</span><input name="apiKey" type="password" autoComplete="new-password" required minLength={8} maxLength={2000} /><small>{c.connectionsHelp}</small></label>
            </div>
            <button className={styles.button} data-state={busy === "create" ? "loading" : "default"} disabled={busy === "create"}>{busy === "create" ? c.saving : c.save}</button>
          </form>
          {connections.length ? <div className={styles.grid}>{connections.map((connection) => (
            <article className={styles.card} key={connection.id}>
              <div className={styles.cardHead}><div><h3>{connection.name}</h3><p className={styles.muted}>{connection.provider} · {connection.baseUrl}</p></div><span className={styles.status} data-tone={connection.status === "active" ? "good" : connection.status === "error" ? "bad" : "warn"}>{connection.status}</span></div>
              <dl><div><dt>{c.username}</dt><dd>{connection.usernameHint}</dd></div><div><dt>{c.lastSync}</dt><dd>{connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString(locale) : c.never}</dd></div></dl>
              <div className={styles.actions}><button className={styles.buttonQuiet} data-state={busy === `${connection.id}:test` ? "loading" : "default"} onClick={() => void connectionAction(connection.id, "test")}>{c.test}</button><button className={styles.button} data-state={busy === `${connection.id}:synchronize` ? "loading" : "default"} onClick={() => void connectionAction(connection.id, "synchronize")}>{c.sync}</button><button className={styles.buttonQuiet} onClick={() => void connectionAction(connection.id, "deactivate")}>{c.deactivate}</button></div>
            </article>
          ))}</div> : <p className={styles.empty}>{loading ? "…" : c.noConnections}</p>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><h2>{c.grants}</h2><p>{c.grantsHelp}</p></div></div>
          {grants.filter((grant) => grant.status === "active").length ? <div className={styles.grid}>{grants.filter((grant) => grant.status === "active").map((grant) => (
            <article className={styles.card} key={grant.id}>
              <div className={styles.cardHead}><div><h3>{grant.service.name}</h3><p className={styles.muted}>{grant.service.groupName ?? grant.service.kind}</p></div><span className={styles.status} data-tone={grant.service.available ? "good" : "warn"}>{grant.service.available ? "active" : "unavailable"}</span></div>
              <div><strong>{c.fields}</strong><ul className={styles.fields}>{grant.service.fields.map((field) => <li key={field.key}>{field.label}{field.required ? " *" : ""}</li>)}</ul></div>
              <Link className={styles.button} href={`/${locale}/seller-dashboard/bridge/products/new?grant=${grant.id}`}>{c.create}</Link>
            </article>
          ))}</div> : <p className={styles.empty}>{c.noGrants}</p>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><h2>{c.orders}</h2><p>{c.ordersHelp}</p></div></div>
          {orders.length ? <div className={styles.grid}>{orders.map((order) => (
            <article className={styles.card} key={order.id}>
              <div className={styles.cardHead}><div><h3>{order.productTitle}</h3><p className={styles.muted}>#{order.orderId} · {order.serviceName}</p></div><span className={styles.status} data-tone={order.status === "succeeded" ? "good" : order.status === "failed" ? "bad" : "warn"}>{order.status}</span></div>
              <ul className={styles.fields}>{Object.entries(order.fields?.fields ?? {}).map(([key, value]) => <li key={key}>{key}: {value}</li>)}</ul>
              {["manual_required", "failed"].includes(order.status) ? <><label className={styles.field}><span>{c.result}</span><textarea value={results[order.id] ?? ""} onChange={(event) => setResults((current) => ({ ...current, [order.id]: event.target.value }))} maxLength={10000} /><small>{order.errorCode ?? " "}</small></label><div className={styles.actions}><button className={styles.button} disabled={!results[order.id]?.trim() || Boolean(busy)} onClick={() => void orderAction(order.id, "complete")}>{c.complete}</button>{order.mayRetry ? <button className={styles.buttonQuiet} disabled={Boolean(busy)} onClick={() => void orderAction(order.id, "retry")}>{c.retry}</button> : null}</div></> : null}
            </article>
          ))}</div> : <p className={styles.empty}>{c.noOrders}</p>}
        </section>
        <div aria-live="polite">{error ? <p className={styles.error}>{error}</p> : null}{message ? <p className={styles.success}>{message}</p> : null}</div>
      </main>
    </div>
  );
}
