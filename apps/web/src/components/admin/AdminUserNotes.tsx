"use client";

import { scheduleEffectTask } from "@/lib/effect-task";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminUserNote, AdminUserNotesPage } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import type { Locale } from "@/lib/i18n";
import styles from "./AdminUserNotes.module.css";

const copy = {
  en: { title: "Admin notes", hint: "Notes stay internal unless you choose to share them with sellers who have an order from this customer.", label: "New note", placeholder: "Describe the behavior or issue factually…", share: "Share this note with the customer's sellers", shared: "Visible to sellers", internal: "Admin only", add: "Add note", saving: "Saving…", error: "Could not save the note.", loadError: "Could not load notes.", empty: "No notes yet.", more: "Older notes" },
  fa: { title: "یادداشت‌های مدیر", hint: "یادداشت‌ها فقط برای مدیران هستند، مگر اینکه اشتراک با فروشندگان این مشتری را انتخاب کنید.", label: "یادداشت جدید", placeholder: "رفتار یا مشکل را دقیق و روشن بنویسید…", share: "این یادداشت را با فروشندگان این مشتری به اشتراک بگذار", shared: "قابل مشاهده برای فروشندگان", internal: "فقط مدیران", add: "ثبت یادداشت", saving: "در حال ثبت…", error: "یادداشت ثبت نشد.", loadError: "یادداشت‌ها بارگذاری نشدند.", empty: "هنوز یادداشتی ثبت نشده است.", more: "یادداشت‌های قدیمی‌تر" },
  ar: { title: "ملاحظات الإدارة", hint: "تبقى الملاحظات داخلية إلا إذا اخترت مشاركتها مع بائعي هذا العميل.", label: "ملاحظة جديدة", placeholder: "صف السلوك أو المشكلة بوضوح…", share: "مشاركة هذه الملاحظة مع بائعي العميل", shared: "مرئية للبائعين", internal: "للإدارة فقط", add: "إضافة ملاحظة", saving: "جارٍ الحفظ…", error: "تعذر حفظ الملاحظة.", loadError: "تعذر تحميل الملاحظات.", empty: "لا توجد ملاحظات بعد.", more: "ملاحظات أقدم" }
} as const;

export function AdminUserNotes({ userId, locale }: { userId: string; locale: Locale }) {
  const c = copy[locale];
  const [body, setBody] = useState("");
  const [sellerVisible, setSellerVisible] = useState(false);
  const [notes, setNotes] = useState<AdminUserNote[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (nextCursor?: string) => {
    setLoading(true); setError("");
    try {
      const response = await api.get<AdminUserNotesPage>(`/admin/users/${userId}/notes`, { params: { limit: 10, ...(nextCursor ? { cursor: nextCursor } : {}) } });
      setNotes((current) => nextCursor ? [...current, ...response.data.items] : response.data.items);
      setCursor(response.data.nextCursor);
    } catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [userId, c.loadError]);
  useEffect(() => scheduleEffectTask(() => { void load(); }), [load]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || body.trim().length < 3) return;
    setSaving(true); setError("");
    try {
      const response = await api.post<AdminUserNote>(`/admin/users/${userId}/notes`, { body: body.trim(), sellerVisible });
      setNotes((current) => [response.data, ...current]);
      setBody("");
      setSellerVisible(false);
    } catch { setError(c.error); }
    finally { setSaving(false); }
  }

  return <section className={styles.panel} aria-labelledby="admin-user-notes-title">
    <header><h3 id="admin-user-notes-title">{c.title}</h3><p>{c.hint}</p></header>
    <form onSubmit={(event) => void add(event)}><label htmlFor="admin-user-note">{c.label}</label><textarea id="admin-user-note" value={body} onChange={(event) => setBody(event.target.value)} minLength={3} maxLength={1000} rows={3} placeholder={c.placeholder} required /><label className={styles.share}><input type="checkbox" checked={sellerVisible} onChange={(event) => setSellerVisible(event.target.checked)} />{c.share}</label><button type="submit" disabled={saving || body.trim().length < 3}>{saving ? c.saving : c.add}</button></form>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {!loading && notes.length === 0 ? <p className={styles.empty}>{c.empty}</p> : null}
    <ol className={styles.notes}>{notes.map((note) => <li key={note.id}><p>{note.body}</p><div><strong>{note.sellerVisible ? c.shared : c.internal}</strong><span>{note.authorName}</span><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString(locale)}</time></div></li>)}</ol>
    {cursor ? <button className={styles.more} type="button" disabled={loading} onClick={() => void load(cursor)}>{c.more}</button> : null}
  </section>;
}
