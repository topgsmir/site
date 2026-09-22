"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./ContentAiPanel.module.css";

type Profile = { id: string; name: string; status: string };
const copy = {
  en: { heading: "Writing models", hint: "Assign a tested model to each editor. Seller AI access is granted separately in seller permissions.", blog: "Blog writing", product: "Product writing", none: "Not configured", save: "Assign model", error: "Could not update writing models. Try again.", saved: "Model assigned.", retry: "Reload" },
  fa: { heading: "مدل‌های نویسندگی", hint: "برای هر ویرایشگر یک مدل آزمایش‌شده انتخاب کنید. دسترسی فروشنده را جداگانه در بخش دسترسی‌ها فعال کنید.", blog: "نوشتن مقاله", product: "نوشتن متن محصول", none: "تنظیم نشده", save: "انتخاب مدل", error: "تنظیم مدل‌ها انجام نشد. دوباره تلاش کنید.", saved: "مدل انتخاب شد.", retry: "بارگذاری دوباره" },
  ar: { heading: "نماذج الكتابة", hint: "اختر نموذجاً مختبراً لكل محرر. تُمنح صلاحية البائع بشكل منفصل في إعدادات الصلاحيات.", blog: "كتابة المقالات", product: "كتابة المنتجات", none: "غير مُعدّ", save: "تعيين النموذج", error: "تعذر تحديث نماذج الكتابة. حاول مجدداً.", saved: "تم تعيين النموذج.", retry: "إعادة التحميل" }
};

export function AuthoringModelBindings({ locale, profiles }: { locale: Locale; profiles: Profile[] }) {
  const c = copy[locale];
  const [bindings, setBindings] = useState({ blog: "", product: "" });
  const [selected, setSelected] = useState({ blog: "", product: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const profileVersion = profiles.map((profile) => `${profile.id}:${profile.status}`).join(",");
  useEffect(() => {
    const controller = new AbortController();
    Promise.all((["blog", "product"] as const).map(async (kind) => [kind, (await api.get<{ profile: Profile | null }>(`/ai/capabilities/${kind}_authoring/profile`, { signal: controller.signal })).data.profile?.id ?? ""] as const))
      .then((entries) => { const value = { blog: entries[0][1], product: entries[1][1] }; setBindings(value); setSelected(value); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [profileVersion, reload]);
  async function assign(kind: "blog" | "product") {
    setBusy(true); setError(false); setMessage("");
    try { await api.put(`/ai/capabilities/${kind}_authoring/profile`, { profileId: selected[kind] }); setBindings((current) => ({ ...current, [kind]: selected[kind] })); setMessage(c.saved); }
    catch { setError(true); } finally { setBusy(false); }
  }
  return <section className={styles.panel}>
    <h2>{c.heading}</h2><p>{c.hint}</p>
    {(["blog", "product"] as const).map((kind) => <div className={styles.row} key={kind}>
      <label>{c[kind]}<select value={selected[kind]} disabled={busy} onChange={(event) => setSelected((current) => ({ ...current, [kind]: event.target.value }))}>
        <option value="">{c.none}</option>{profiles.filter((profile) => profile.status === "active").map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
      </select></label><button type="button" disabled={busy || !selected[kind] || selected[kind] === bindings[kind]} onClick={() => void assign(kind)}>{c.save}</button>
    </div>)}
    {error ? <p role="alert">{c.error} <button type="button" onClick={() => setReload((value) => value + 1)}>{c.retry}</button></p> : <p role="status">{message}</p>}
  </section>;
}
