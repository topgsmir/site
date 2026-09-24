"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import styles from "./SmsSettingsWorkspace.module.css";
import layout from "./SecuritySettingsWorkspace.module.css";

type Policy = { action: string; ipLimit: number; subjectLimit: number; ipWindowSeconds: number; subjectWindowSeconds: number; captchaEnabled: boolean };
const captchaActions = new Set(["login", "register", "otp", "comment_submit_guest"]);
const ipOnlyActions = new Set(["captcha_challenge"]);
const groups = [
  { name: ["Access", "دسترسی", "الوصول"], actions: ["login", "register", "otp", "profile", "admin_user", "staff_admin", "staff_setup", "auth_configuration", "captcha_challenge"] },
  { name: ["Commerce", "تجارت", "التجارة"], actions: ["checkout_quote", "coupon", "order", "digital_download", "shipping", "shipping_configuration", "payout", "payment", "payment_callback", "payment_refund", "payment_configuration"] },
  { name: ["Content", "محتوا", "المحتوى"], actions: ["blog", "product", "media", "comment_submit_guest", "comment_submit", "comment_reply", "comment_admin", "product_bulk_undo"] },
  { name: ["Platform", "پلتفرم", "المنصة"], actions: ["seller", "notice_configuration", "usd_configuration", "sms_configuration", "goghdi_configuration", "media_admin", "bridge", "signed_ticket", "ai_profile", "ai_profile_test", "ai_run", "analytics", "backup_admin", "backup_restore"] }
] as const;
const actionNames: Record<string, [string, string, string]> = {
  login: ["Sign in", "ورود", "تسجيل الدخول"], register: ["Sign up", "ثبت‌نام", "التسجيل"], otp: ["SMS code requests and verification", "درخواست و تأیید کد پیامکی", "طلب رمز الرسالة والتحقق"],
  profile: ["Profile changes", "تغییرات پروفایل", "تعديلات الملف الشخصي"], admin_user: ["User administration", "مدیریت کاربران", "إدارة المستخدمين"], staff_admin: ["Staff administration", "مدیریت کارکنان", "إدارة الموظفين"], staff_setup: ["Staff setup", "راه‌اندازی کارکنان", "إعداد الموظفين"], auth_configuration: ["Authentication settings", "تنظیمات احراز هویت", "إعدادات المصادقة"], captcha_challenge: ["Browser challenge requests", "درخواست بررسی مرورگر", "طلبات فحص المتصفح"],
  checkout_quote: ["Checkout quotes", "استعلام تسویه‌حساب", "تسعير الدفع"], coupon: ["Coupon changes", "تغییرات کد تخفیف", "تعديلات القسائم"], order: ["Orders", "سفارش‌ها", "الطلبات"], digital_download: ["Digital downloads", "دانلود محصولات دیجیتال", "تنزيلات المنتجات الرقمية"], shipping: ["Shipping updates", "به‌روزرسانی ارسال", "تحديث الشحن"], shipping_configuration: ["Shipping settings", "تنظیمات ارسال", "إعدادات الشحن"], payout: ["Payouts", "تسویه‌ها", "المدفوعات للبائعين"], payment: ["Payment initiation", "آغاز پرداخت", "بدء الدفع"], payment_callback: ["Payment callbacks", "بازگشت پرداخت", "استدعاءات الدفع"], payment_refund: ["Refunds", "بازپرداخت‌ها", "المبالغ المستردة"], payment_configuration: ["Payment settings", "تنظیمات پرداخت", "إعدادات الدفع"],
  blog: ["Blog changes", "تغییرات وبلاگ", "تعديلات المدونة"], product: ["Product changes", "تغییرات محصول", "تعديلات المنتجات"], media: ["Media uploads", "بارگذاری رسانه", "رفع الوسائط"], comment_submit_guest: ["Guest comments", "دیدگاه مهمان", "تعليقات الضيوف"], comment_submit: ["Signed-in comments", "دیدگاه کاربران واردشده", "تعليقات المستخدمين"], comment_reply: ["Comment author replies", "پاسخ نویسنده", "ردود المؤلفين"], comment_admin: ["Comment moderation", "مدیریت دیدگاه", "إدارة التعليقات"], product_bulk_undo: ["Bulk product undo", "بازگردانی گروهی محصول", "التراجع الجماعي عن المنتجات"],
  seller: ["Seller administration", "مدیریت فروشندگان", "إدارة البائعين"], notice_configuration: ["Notice settings", "تنظیمات اعلان", "إعدادات الإشعار"], usd_configuration: ["USD rate settings", "تنظیمات نرخ دلار", "إعدادات سعر الدولار"], sms_configuration: ["SMS settings", "تنظیمات پیامک", "إعدادات الرسائل"], goghdi_configuration: ["Goghdi settings", "تنظیمات گفت‌وگو", "إعدادات Goghdi"], media_admin: ["Upload management", "مدیریت آپلود ها", "إدارة الملفات المرفوعة"], bridge: ["Bridge operations", "عملیات بریج", "عمليات الجسر"], signed_ticket: ["Signed order tickets", "بلیت‌های امضاشده سفارش", "تذاكر الطلبات الموقعة"], ai_profile: ["AI profiles", "نمایه‌های هوش مصنوعی", "ملفات الذكاء الاصطناعي"], ai_profile_test: ["AI profile tests", "آزمایش نمایه هوش مصنوعی", "اختبارات ملفات الذكاء الاصطناعي"], ai_run: ["AI runs", "اجرای هوش مصنوعی", "تشغيل الذكاء الاصطناعي"], analytics: ["Analytics reads", "خواندن گزارش‌ها", "قراءة التحليلات"], backup_admin: ["Backup operations", "عملیات پشتیبان‌گیری", "عمليات النسخ الاحتياطي"], backup_restore: ["Backup restores", "بازیابی پشتیبان", "استعادة النسخ الاحتياطية"]
};
const actionDescriptions: Record<string, [string, string, string]> = {
  login: ["Sign-in attempts using an email or phone number.", "تلاش برای ورود با ایمیل یا شماره تلفن.", "محاولات الدخول بالبريد الإلكتروني أو رقم الهاتف."],
  register: ["Creating a new buyer account.", "ساخت حساب جدید برای خریدار.", "إنشاء حساب جديد للمشتري."],
  otp: ["Requesting or verifying an SMS sign-in code.", "درخواست یا تأیید کد ورود پیامکی.", "طلب رمز الدخول عبر الرسائل أو التحقق منه."],
  profile: ["Changing the signed-in user's profile.", "تغییر پروفایل کاربر واردشده.", "تعديل ملف المستخدم المسجل."],
  admin_user: ["Reviewing or changing user access, status, and account data.", "بررسی یا تغییر دسترسی، وضعیت و اطلاعات حساب کاربران.", "مراجعة أو تعديل وصول المستخدمين وحالتهم وبيانات حساباتهم."],
  staff_admin: ["Inviting, changing, or revoking platform staff.", "دعوت، تغییر یا لغو دسترسی کارکنان پلتفرم.", "دعوة موظفي المنصة أو تعديلهم أو إلغاء وصولهم."],
  staff_setup: ["Setting up a staff account through an invitation link.", "راه‌اندازی حساب کارمند از طریق لینک دعوت.", "إعداد حساب موظف عبر رابط الدعوة."],
  auth_configuration: ["Admin changes to sign-in and security settings.", "تغییر تنظیمات ورود و امنیت توسط مدیر.", "تغييرات المدير على إعدادات الدخول والأمان."],
  captcha_challenge: ["Requesting a browser verification challenge for public forms.", "دریافت چالش بررسی مرورگر برای فرم‌های عمومی.", "طلب تحدي فحص المتصفح للنماذج العامة."],
  checkout_quote: ["Checking cart prices before placing an order.", "بررسی قیمت سبد خرید پیش از ثبت سفارش.", "التحقق من أسعار السلة قبل إنشاء الطلب."],
  coupon: ["Creating or changing seller and platform coupons.", "ساخت یا تغییر کدهای تخفیف فروشنده و پلتفرم.", "إنشاء أو تعديل قسائم البائع والمنصة."],
  order: ["Creating orders or changing their status and shipping details.", "ثبت سفارش یا تغییر وضعیت و اطلاعات ارسال آن.", "إنشاء الطلبات أو تعديل حالتها وبيانات شحنها."],
  digital_download: ["Issuing protected download links for purchased digital items.", "صدور لینک دانلود محافظت‌شده برای کالای دیجیتال خریداری‌شده.", "إصدار روابط تنزيل محمية للعناصر الرقمية المشتراة."],
  shipping: ["Registering or syncing an order with the active shipping provider.", "ثبت یا همگام‌سازی سفارش با سرویس فعال ارسال.", "تسجيل الطلب أو مزامنته مع مزود الشحن النشط."],
  shipping_configuration: ["Changing seller shipping profiles or admin shipping settings.", "تغییر پروفایل ارسال فروشنده یا تنظیمات ارسال مدیر.", "تعديل ملف شحن البائع أو إعدادات الشحن لدى المدير."],
  payout: ["Requesting a seller payout or changing its status.", "درخواست تسویه فروشنده یا تغییر وضعیت آن.", "طلب صرف مستحقات البائع أو تغيير حالته."],
  payment: ["Starting payment for an order or checkout.", "شروع پرداخت برای سفارش یا تسویه‌حساب.", "بدء الدفع لطلب أو لعملية إتمام الشراء."],
  payment_callback: ["Processing payment-provider returns and local payment completion.", "پردازش بازگشت درگاه و تکمیل پرداخت محلی.", "معالجة عودة بوابة الدفع وإتمام الدفع المحلي."],
  payment_refund: ["Admin refund requests for payment transactions.", "درخواست بازپرداخت تراکنش توسط مدیر.", "طلبات المدير لاسترداد معاملات الدفع."],
  payment_configuration: ["Admin changes to payment methods and their credentials.", "تغییر روش‌های پرداخت و اطلاعات اتصال آن‌ها توسط مدیر.", "تعديل المدير لطرق الدفع وبيانات اتصالها."],
  blog: ["Creating, editing, publishing, and organizing blog content.", "ساخت، ویرایش، انتشار و دسته‌بندی محتوای وبلاگ.", "إنشاء محتوى المدونة وتعديله ونشره وتنظيمه."],
  product: ["Creating, editing, reviewing, and restoring products and offers.", "ساخت، ویرایش، بررسی و بازیابی محصولات و پیشنهادها.", "إنشاء المنتجات والعروض وتعديلها ومراجعتها واستعادتها."],
  media: ["Uploading media files and product images.", "بارگذاری فایل رسانه یا تصویر محصول.", "رفع ملفات الوسائط وصور المنتجات."],
  comment_submit_guest: ["Guests posting comments on product and blog pages.", "ثبت دیدگاه مهمان در صفحه محصول و مقاله.", "نشر الضيوف لتعليقات على صفحات المنتجات والمقالات."],
  comment_submit: ["Signed-in users posting product and blog comments.", "ثبت دیدگاه محصول و مقاله توسط کاربر واردشده.", "نشر المستخدمين المسجلين لتعليقات المنتجات والمقالات."],
  comment_reply: ["Authors replying to or flagging product and blog comments.", "پاسخ نویسنده به دیدگاه محصول و مقاله یا گزارش آن.", "رد المؤلفين على تعليقات المنتجات والمقالات أو الإبلاغ عنها."],
  comment_admin: ["Admin comment settings and moderation decisions.", "تغییر تنظیمات دیدگاه و بررسی آن‌ها توسط مدیر.", "إعدادات التعليقات وقرارات مراجعتها لدى المدير."],
  product_bulk_undo: ["Undoing a bulk product change.", "بازگردانی تغییر گروهی محصولات.", "التراجع عن تعديل جماعي للمنتجات."],
  seller: ["Changing sellers, invitations, agents, or public seller profiles.", "تغییر فروشندگان، دعوت‌ها، نمایندگان یا پروفایل عمومی فروشنده.", "تعديل البائعين والدعوات والوكلاء أو ملفات البائع العامة."],
  notice_configuration: ["Admin changes to the platform notice.", "تغییر اعلان پلتفرم توسط مدیر.", "تعديل المدير لإشعار المنصة."],
  usd_configuration: ["Admin changes to exchange-rate providers and settings.", "تغییر سرویس و تنظیمات نرخ ارز توسط مدیر.", "تعديل المدير لمزودي سعر الصرف وإعداداته."],
  sms_configuration: ["Admin changes to SMS provider settings.", "تغییر تنظیمات سرویس پیامک توسط مدیر.", "تعديل المدير لإعدادات خدمة الرسائل."],
  goghdi_configuration: ["Admin changes to Goghdi chat connection settings.", "تغییر تنظیمات اتصال گفت‌وگوی Goghdi توسط مدیر.", "تعديل المدير لإعدادات اتصال دردشة Goghdi."],
  media_admin: ["Searching, trashing, restoring, and inspecting managed uploads.", "جست‌وجو، انتقال به زباله‌دان، بازیابی و بررسی آپلود های مدیریت‌شده.", "البحث في الملفات المُدارة ونقلها إلى المهملات واستعادتها وفحصها."],
  bridge: ["Testing or syncing bridge connections and retrying bridge orders.", "آزمایش یا همگام‌سازی اتصال بریج و تلاش دوباره برای سفارش بریج.", "اختبار اتصالات الجسر أو مزامنتها وإعادة محاولة طلباته."],
  signed_ticket: ["Issuing signed order tickets for authenticated buyers.", "صدور بلیت امضاشده سفارش برای خریدار واردشده.", "إصدار تذاكر طلبات موقعة للمشترين المسجلين."],
  ai_profile: ["Creating, editing, or deleting AI model profiles.", "ساخت، ویرایش یا حذف نمایه مدل هوش مصنوعی.", "إنشاء ملفات نماذج الذكاء الاصطناعي أو تعديلها أو حذفها."],
  ai_profile_test: ["Running a test for an AI model profile.", "اجرای آزمایش برای نمایه مدل هوش مصنوعی.", "تشغيل اختبار لملف نموذج ذكاء اصطناعي."],
  ai_run: ["Sending a question to the data assistant or approving a run.", "ارسال پرسش به دستیار داده یا تأیید اجرای آن.", "إرسال سؤال إلى مساعد البيانات أو الموافقة على تشغيله."],
  analytics: ["Loading the analytics overview and its aggregates.", "دریافت نمای کلی گزارش‌ها و آمار آن.", "تحميل نظرة عامة على التحليلات وإحصاءاتها."],
  backup_admin: ["Changing backup settings, managing destinations, running backups, and downloading archives.", "تغییر تنظیمات پشتیبان، مدیریت مقصدها، اجرای پشتیبان و دانلود آرشیوها.", "تعديل إعدادات النسخ وإدارة الوجهات وتشغيل النسخ وتنزيل الأرشيفات."],
  backup_restore: ["Uploading, checking, and confirming backup restores.", "بارگذاری، بررسی و تأیید بازیابی نسخه پشتیبان.", "رفع النسخ الاحتياطية وفحصها وتأكيد استعادتها."]
};
const copy = {
  en: { rate: "Rate limit", captcha: "CAPTCHA", rateIntro: "Tune limits for authentication, commerce, content, and platform operations. Each limit uses shared database buckets.", captchaIntro: "Require a browser check for public forms that people submit. SMS verification shares the OTP rate limit, but the browser check applies when requesting a code.", ip: "Requests per IP", subject: "Requests per account or subject", ipWindow: "IP window (minutes)", subjectWindow: "Account or subject window (minutes)", enabled: "Enabled", disabled: "Disabled", unsaved: "Unsaved changes", loading: "Loading security settings", save: "Save", saved: "Saved.", error: "Could not save this policy.", loadError: "Security policies could not be loaded.", retry: "Try again", ipOnly: "This operation is limited by IP address only." },
  fa: { rate: "محدودیت درخواست", captcha: "کپچا", rateIntro: "سقف درخواست‌های احراز هویت، تجارت، محتوا و عملیات پلتفرم را تنظیم کنید. محدودیت‌ها در پایگاه داده مشترک اعمال می‌شوند.", captchaIntro: "بررسی مرورگر را برای فرم‌های عمومی فعال کنید. درخواست و تأیید کد پیامکی محدودیت مشترک دارند، اما بررسی مرورگر هنگام درخواست کد انجام می‌شود.", ip: "درخواست برای هر IP", subject: "درخواست برای هر حساب یا شناسه", ipWindow: "بازه IP (دقیقه)", subjectWindow: "بازه حساب یا شناسه (دقیقه)", enabled: "فعال", disabled: "غیرفعال", unsaved: "تغییرات ذخیره‌نشده", loading: "دریافت تنظیمات امنیتی", save: "ذخیره", saved: "ذخیره شد.", error: "ذخیره این تنظیم انجام نشد.", loadError: "دریافت تنظیمات امنیتی انجام نشد.", retry: "تلاش دوباره", ipOnly: "این عملیات فقط براساس IP محدود می‌شود." },
  ar: { rate: "حد الطلبات", captcha: "التحقق البشري", rateIntro: "اضبط حدود المصادقة والتجارة والمحتوى وعمليات المنصة. تُطبق الحدود في قاعدة البيانات المشتركة.", captchaIntro: "فعّل فحص المتصفح للنماذج العامة. يشترك طلب رمز الرسالة والتحقق منه في حد واحد، ويُطلب الفحص عند طلب الرمز.", ip: "طلبات لكل IP", subject: "طلبات لكل حساب أو معرّف", ipWindow: "فترة IP (بالدقائق)", subjectWindow: "فترة الحساب أو المعرّف (بالدقائق)", enabled: "مفعل", disabled: "معطل", unsaved: "تغييرات غير محفوظة", loading: "جارٍ تحميل إعدادات الأمان", save: "حفظ", saved: "تم الحفظ.", error: "تعذر حفظ هذا الإعداد.", loadError: "تعذر تحميل إعدادات الأمان.", retry: "إعادة المحاولة", ipOnly: "تُحد هذه العملية حسب عنوان IP فقط." }
} as const;
const localeIndex = { en: 0, fa: 1, ar: 2 } as const;

export function SecuritySettingsWorkspace({ locale, view }: { locale: Locale; view: "rate-limit" | "captcha" }) {
  const c = copy[locale];
  const [policies, setPolicies] = useState<Policy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirtyActions, setDirtyActions] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [messageAction, setMessageAction] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try { setPolicies((await api.get<Policy[]>("/admin/security/policies")).data); setDirtyActions(new Set()); }
    catch { setError(c.loadError); }
    finally { setLoading(false); }
  }, [c.loadError]);
  useEffect(() => { void load(); }, [load]);

  function change(action: string, key: keyof Policy, value: number | boolean) {
    setPolicies((current) => current?.map((policy) => policy.action === action ? { ...policy, [key]: value } : policy) ?? null);
    setDirtyActions((current) => new Set(current).add(action));
    setMessageAction(null);
    setErrorAction(null);
  }
  async function save(event: FormEvent<HTMLFormElement>, policy: Policy) {
    event.preventDefault(); setBusy(policy.action); setErrorAction(null); setMessageAction(null);
    try {
      const { action, ...body } = policy;
      const result = (await api.patch<Policy>(`/admin/security/policies/${action}`, body)).data;
      setPolicies((current) => current?.map((item) => item.action === action ? result : item) ?? null);
      setDirtyActions((current) => { const next = new Set(current); next.delete(action); return next; });
      setMessageAction(action);
    } catch { setErrorAction(policy.action); }
    finally { setBusy(null); }
  }
  function renderPolicy(policy: Policy) {
    const title = actionNames[policy.action]?.[localeIndex[locale]] ?? policy.action;
    const description = actionDescriptions[policy.action]?.[localeIndex[locale]];
    return <form className={`${layout.policy} ${view === "captcha" ? layout.captchaPolicy : layout.ratePolicy}`} key={policy.action} onSubmit={(event) => void save(event, policy)}>
      <div className={layout.policyHeader}><div><h3>{title}</h3>{view === "captcha" ? <p>{policy.captchaEnabled ? c.enabled : c.disabled}</p> : <>{description ? <p>{description}</p> : null}{ipOnlyActions.has(policy.action) ? <p>{c.ipOnly}</p> : null}</>}</div>
        {view === "captcha" ? <label className={styles.toggle}><span className={styles.visuallyHidden}>{title}</span><input type="checkbox" checked={policy.captchaEnabled} disabled={busy !== null} onChange={(event) => change(policy.action, "captchaEnabled", event.target.checked)} /><span aria-hidden="true"><i /></span></label> : null}
      </div>
      {view === "rate-limit" ? <div className={layout.fields}>
        {([ ["ipLimit", c.ip, 1, 1000], ["ipWindowSeconds", c.ipWindow, 1, 1440], ...(!ipOnlyActions.has(policy.action) ? [["subjectLimit", c.subject, 1, 1000], ["subjectWindowSeconds", c.subjectWindow, 1, 1440]] as const : []) ] as const).map(([key, label, min, max]) => <label key={key}><span>{label}</span><input type="number" min={min} max={max} required disabled={busy !== null} value={key.endsWith("Seconds") ? policy[key] / 60 : policy[key]} onChange={(event) => change(policy.action, key, Number(event.target.value) * (key.endsWith("Seconds") ? 60 : 1))} /></label>)}
      </div> : null}
      <footer className={layout.policyActions}><span aria-live="polite" role={errorAction === policy.action ? "alert" : undefined} className={errorAction === policy.action ? layout.policyError : dirtyActions.has(policy.action) ? layout.policyPending : layout.policySuccess}>{errorAction === policy.action ? c.error : dirtyActions.has(policy.action) ? c.unsaved : messageAction === policy.action ? c.saved : null}</span><button type="submit" disabled={busy !== null}>{c.save}</button></footer>
    </form>;
  }
  return <section className={styles.workspace} aria-labelledby="security-settings-title">
    <header className={styles.header}><span>{locale === "en" ? "Security" : locale === "fa" ? "امنیت" : "الأمان"}</span><h1 id="security-settings-title">{view === "rate-limit" ? c.rate : c.captcha}</h1><p>{view === "rate-limit" ? c.rateIntro : c.captchaIntro}</p></header>
    {loading && !policies ? <div className={styles.skeleton} role="status" aria-label={c.loading}><i aria-hidden="true" /><i aria-hidden="true" /></div> : !policies ? <div className={styles.error} role="alert"><p>{error || c.loadError}</p><button type="button" onClick={() => void load()}>{c.retry}</button></div> :
      view === "captcha" ? <div className={layout.list}>{policies.filter((policy) => captchaActions.has(policy.action)).map(renderPolicy)}</div> :
      <div className={layout.groups}>{groups.map((group) => <section key={group.actions[0]} className={layout.group}><h2>{group.name[localeIndex[locale]]}</h2><div className={layout.list}>{group.actions.map((action) => policies.find((policy) => policy.action === action)).filter((policy): policy is Policy => Boolean(policy)).map(renderPolicy)}</div></section>)}</div>}
    {policies && error ? <p className={styles.errorText} role="alert">{error}</p> : null}
  </section>;
}
