"use client";

import { isAxiosError } from "axios";
import { AuthoringModelBindings } from "@/components/ai/AuthoringModelBindings";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Locale } from "@/lib/i18n";
import { API_BASE, api } from "@/lib/api/client";
import styles from "./AiWorkspace.module.css";
import { AiRunError, aiRunErrorMessage } from "./ai-run-error";

type View = "models" | "assistant";
type Profile = {
  id: string;
  name: string;
  provider: "openai" | "anthropic";
  modelId: string;
  baseUrl: string;
  apiKeyHint: string;
  inputPricePerMillionUsd: string | null;
  outputPricePerMillionUsd: string | null;
  status: "inactive" | "active" | "error";
  lastTestedAt: string | null;
};
type ProfileFormState = {
  name: string;
  provider: "openai" | "anthropic";
  modelId: string;
  baseUrl: string;
  apiKey: string;
  inputPricePerMillionUsd: string;
  outputPricePerMillionUsd: string;
};
type ConversationSummary = {
  id: string;
  title: string;
  estimatedCostUsd: string | null;
  updatedAt: string;
};
type Evidence = {
  id?: string;
  name?: string;
  status?: string;
  sql?: string;
  executionId?: string;
  purpose?: string;
  approvalType?: "continuation" | "sql" | "browser_tool";
  request?: BrowserToolRequest;
  rowCount?: number;
  durationMs?: number;
};
type BrowserToolRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  body?: unknown;
  risk: "read" | "write" | "destructive" | "critical";
  description: string;
  idempotencyKey?: string;
  responseMode?: "json" | "download";
};
type FileInputSpec = { label: string; accept: string; maxBytes: number };
type ToolResult = {
  tool: string;
  rows: Record<string, unknown>[];
  truncated?: boolean;
};
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structuredContent?: {
    rows?: Record<string, unknown>[];
    truncated?: boolean;
    chart?: ChartSpec | null;
    toolResults?: ToolResult[];
  } | null;
};
type ChartSpec = {
  type: "line" | "bar" | "stacked-bar";
  xKey: string;
  yKeys: string[];
  title: string;
};
type RunMeta = {
  id?: string;
  status?: string;
  inputMessageId?: string;
  outputMessageId?: string | null;
  provider?: string;
  modelId?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: string | null;
  durationMs?: number | null;
  tools?: Evidence[];
};
type ProviderError = {
  provider: string;
  statusCode: number | null;
  code: string | null;
  type: string | null;
  requestId: string | null;
  message: string;
};
type Activity = {
  phase: "planning" | "answering";
  status: "running" | "completed" | "failed";
};

const copy = {
  en: {
    modelsTitle: "Models",
    modelsIntro:
      "Create encrypted, reusable model profiles for the assistant and future AI features.",
    assistantTitle: "AI assistant",
    newChat: "New analysis",
    history: "Conversations",
    profiles: "Saved models",
    provider: "Provider",
    name: "Profile name",
    model: "Model ID",
    url: "API base URL",
    key: "API key",
    save: "Save model",
    saving: "Saving…",
    saveChanges: "Save changes",
    editModel: "Edit",
    deleteModel: "Delete",
    cancel: "Cancel",
    replacementKey: "New API key",
    replacementKeyHint: "Leave blank to keep the current key.",
    deleteModelConfirm:
      "Delete {name}? The encrypted API key will be permanently removed.",
    test: "Test connection",
    use: "Set as default",
    active: "Default",
    deactivate: "Deactivate",
    selectModel: "Model for this conversation",
    question: "Ask about or manage any admin and site feature…",
    send: "Send",
    working: "Working…",
    empty: "Choose or start a conversation, then ask an operational question or request an admin action.",
    disclosure: "Masked reporting data and approved, redacted tool results are sent to the selected provider. API actions run in this browser under your current permissions.",
    toolsAvailable: "allowlisted tools available across",
    toolDomains: "feature areas",
    approve: "Approve and run",
    reject: "Stop",
    sqlTitle: "SQL approval required",
    toolTitle: "Tool approval required",
    toolRunningTitle: "Tool result pending",
    continuationTitle: "Continue this analysis?",
    rows: "Supporting rows",
    noRows: "No supporting rows were returned.",
    error: "The AI request could not be completed.",
    configure: "Create and test a model before asking questions.",
    profileHint:
      "Keys are encrypted and never shown again. Custom URLs must be public HTTPS endpoints on port 443.",
    delete: "Delete conversation",
    noProfiles: "No model has been saved yet.",
    activityTitle: "Agent activity",
    activityLive: "Live",
    activityComplete: "Complete",
    planning: "Understanding the request",
    answering: "Writing the answer",
    toolCall: "Tool call",
    inputPrice: "Input price / 1M tokens (USD)",
    outputPrice: "Output price / 1M tokens (USD)",
    pricingHint:
      "Enter both current provider rates. Costs remain unavailable when pricing is blank.",
    pricing: "Pricing",
    chatTotal: "Chat total",
    responseCost: "Estimated response cost",
    status: {
      inactive: "Not tested",
      active: "Ready",
      error: "Test failed",
      running: "In progress",
      completed: "Done",
      failed: "Failed",
      proposed: "Approval needed",
      rejected: "Rejected",
    },
  },
  fa: {
    modelsTitle: "مدل‌ها",
    modelsIntro:
      "مدل‌های رمزنگاری‌شده و قابل‌استفاده‌مجدد را برای دستیار و قابلیت‌های آینده هوش مصنوعی ذخیره کنید.",
    assistantTitle: "دستیار هوشمند",
    newChat: "تحلیل جدید",
    history: "گفت‌وگوها",
    profiles: "مدل‌های ذخیره‌شده",
    provider: "ارائه‌دهنده",
    name: "نام مدل",
    model: "شناسه مدل",
    url: "نشانی پایه API",
    key: "کلید API",
    save: "ذخیره مدل",
    saving: "در حال ذخیره…",
    saveChanges: "ذخیره تغییرات",
    editModel: "ویرایش",
    deleteModel: "حذف",
    cancel: "انصراف",
    replacementKey: "کلید API جدید",
    replacementKeyHint: "برای نگه‌داشتن کلید فعلی، این بخش را خالی بگذارید.",
    deleteModelConfirm:
      "مدل «{name}» حذف شود؟ کلید API رمزنگاری‌شده برای همیشه پاک می‌شود.",
    test: "آزمایش اتصال",
    use: "انتخاب به‌عنوان پیش‌فرض",
    active: "پیش‌فرض",
    deactivate: "غیرفعال‌کردن",
    selectModel: "مدل این گفت‌وگو",
    question: "درباره هر بخش مدیریت یا سایت بپرسید یا کاری درخواست کنید…",
    send: "ارسال",
    working: "در حال انجام…",
    empty: "یک گفت‌وگو را انتخاب یا ایجاد کنید؛ سپس سؤال عملیاتی بپرسید یا یک اقدام مدیریتی درخواست کنید.",
    disclosure:
      "داده‌های گزارش و نتیجهٔ پالایش‌شدهٔ ابزارهای تأییدشده برای مدل فرستاده می‌شود. هر درخواست API در همین مرورگر و با دسترسی فعلی شما اجرا می‌شود.",
    toolsAvailable: "ابزار مجاز در",
    toolDomains: "حوزه قابلیت در دسترس است",
    approve: "تأیید و اجرا",
    reject: "توقف",
    sqlTitle: "تأیید SQL لازم است",
    toolTitle: "تأیید ابزار لازم است",
    toolRunningTitle: "نتیجهٔ ابزار هنوز نرسیده است",
    continuationTitle: "تحلیل ادامه پیدا کند؟",
    rows: "ردیف‌های پشتیبان",
    noRows: "داده پشتیبانی برنگشت.",
    error: "درخواست هوش مصنوعی کامل نشد.",
    configure: "پیش از پرسش، یک مدل بسازید و اتصال آن را آزمایش کنید.",
    profileHint:
      "کلید رمزنگاری می‌شود و دوباره نمایش داده نخواهد شد. نشانی سفارشی باید HTTPS عمومی روی درگاه ۴۴۳ باشد.",
    delete: "حذف گفت‌وگو",
    noProfiles: "هنوز مدلی ذخیره نشده است.",
    activityTitle: "فعالیت دستیار",
    activityLive: "زنده",
    activityComplete: "تکمیل شد",
    planning: "درک درخواست",
    answering: "نوشتن پاسخ",
    toolCall: "فراخوانی ابزار",
    inputPrice: "هزینه ورودی هر یک میلیون توکن (دلار)",
    outputPrice: "هزینه خروجی هر یک میلیون توکن (دلار)",
    pricingHint:
      "هر دو نرخ فعلی ارائه‌دهنده را وارد کنید؛ بدون آن هزینه نمایش داده نمی‌شود.",
    pricing: "تعرفه",
    chatTotal: "هزینه کل گفت‌وگو",
    responseCost: "هزینه تخمینی پاسخ",
    status: {
      inactive: "آزمایش‌نشده",
      active: "آماده",
      error: "خطای اتصال",
      running: "در حال اجرا",
      completed: "انجام شد",
      failed: "ناموفق",
      proposed: "نیازمند تأیید",
      rejected: "رد شد",
    },
  },
  ar: {
    modelsTitle: "النماذج",
    modelsIntro:
      "احفظ ملفات نماذج مشفرة وقابلة لإعادة الاستخدام للمساعد وميزات الذكاء الاصطناعي المستقبلية.",
    assistantTitle: "المساعد الذكي",
    newChat: "تحليل جديد",
    history: "المحادثات",
    profiles: "النماذج المحفوظة",
    provider: "المزود",
    name: "اسم النموذج",
    model: "معرّف النموذج",
    url: "عنوان API الأساسي",
    key: "مفتاح API",
    save: "حفظ النموذج",
    saving: "جارٍ الحفظ…",
    saveChanges: "حفظ التغييرات",
    editModel: "تعديل",
    deleteModel: "حذف",
    cancel: "إلغاء",
    replacementKey: "مفتاح API جديد",
    replacementKeyHint: "اتركه فارغاً للاحتفاظ بالمفتاح الحالي.",
    deleteModelConfirm:
      "هل تريد حذف «{name}»؟ سيُحذف مفتاح API المشفر نهائياً.",
    test: "اختبار الاتصال",
    use: "تعيين كافتراضي",
    active: "الافتراضي",
    deactivate: "تعطيل",
    selectModel: "نموذج هذه المحادثة",
    question: "اسأل عن أي ميزة في الإدارة أو الموقع أو اطلب إجراءً…",
    send: "إرسال",
    working: "جارٍ العمل…",
    empty: "اختر محادثة أو ابدأ واحدة، ثم اطرح سؤالاً تشغيلياً أو اطلب إجراءً إدارياً.",
    disclosure: "تُرسل بيانات التقارير المخفية ونتائج الأدوات الموافق عليها بعد تنقيحها إلى المزود المحدد. تُنفذ عمليات API في هذا المتصفح وفق صلاحياتك الحالية.",
    toolsAvailable: "أداة مسموحة متاحة عبر",
    toolDomains: "مجالات للميزات",
    approve: "موافقة وتنفيذ",
    reject: "إيقاف",
    sqlTitle: "موافقة SQL مطلوبة",
    toolTitle: "موافقة الأداة مطلوبة",
    toolRunningTitle: "نتيجة الأداة معلّقة",
    continuationTitle: "متابعة هذا التحليل؟",
    rows: "الصفوف الداعمة",
    noRows: "لم تُرجع صفوف داعمة.",
    error: "تعذر إكمال طلب الذكاء الاصطناعي.",
    configure: "أنشئ نموذجاً واختبره قبل طرح الأسئلة.",
    profileHint:
      "يُشفّر المفتاح ولن يظهر مرة أخرى. يجب أن يكون العنوان المخصص HTTPS عاماً على المنفذ 443.",
    delete: "حذف المحادثة",
    noProfiles: "لم يُحفظ أي نموذج بعد.",
    activityTitle: "نشاط المساعد",
    activityLive: "مباشر",
    activityComplete: "مكتمل",
    planning: "فهم الطلب",
    answering: "كتابة الإجابة",
    toolCall: "استدعاء أداة",
    inputPrice: "سعر الإدخال لكل مليون رمز (الدولار)",
    outputPrice: "سعر الإخراج لكل مليون رمز (الدولار)",
    pricingHint: "أدخل سعري المزود الحاليين؛ لن تظهر التكلفة إذا تُركا فارغين.",
    pricing: "التسعير",
    chatTotal: "إجمالي المحادثة",
    responseCost: "تكلفة الرد التقديرية",
    status: {
      inactive: "غير مختبر",
      active: "جاهز",
      error: "فشل الاختبار",
      running: "قيد التنفيذ",
      completed: "تم",
      failed: "فشل",
      proposed: "بانتظار الموافقة",
      rejected: "مرفوض",
    },
  },
} as const;

const requestErrorCopy = {
  en: {
    invalid: "Check the model details and API URL.",
    unauthorized: "Your session has expired. Sign in again.",
    forbidden: "Only a platform administrator can manage AI models.",
    duplicate: "A model profile with this name already exists.",
    inUse:
      "This model is used in conversation history. Deactivate it instead of deleting it.",
    missing: "This model no longer exists. Refresh the page.",
    limited: "Too many attempts. Wait a moment and try again.",
    provider:
      "The provider rejected the connection test. Check the API key, model ID, and base URL.",
    unavailable: "AI credential encryption is not configured on the server.",
  },
  fa: {
    invalid: "مشخصات مدل و نشانی API را بررسی کنید.",
    unauthorized: "نشست شما منقضی شده است؛ دوباره وارد شوید.",
    forbidden: "فقط مدیر پلتفرم می‌تواند مدل‌های هوش مصنوعی را مدیریت کند.",
    duplicate: "مدلی با این نام قبلاً ذخیره شده است.",
    inUse:
      "این مدل در سابقه گفت‌وگوها استفاده شده است؛ به‌جای حذف، آن را غیرفعال کنید.",
    missing: "این مدل دیگر وجود ندارد؛ صفحه را تازه کنید.",
    limited: "تعداد تلاش‌ها زیاد است؛ کمی صبر کنید و دوباره امتحان کنید.",
    provider:
      "آزمایش اتصال از طرف ارائه‌دهنده رد شد؛ کلید API، شناسه مدل و نشانی پایه را بررسی کنید.",
    unavailable: "رمزنگاری کلیدهای هوش مصنوعی روی سرور پیکربندی نشده است.",
  },
  ar: {
    invalid: "تحقق من بيانات النموذج وعنوان API.",
    unauthorized: "انتهت جلستك؛ سجّل الدخول مجدداً.",
    forbidden: "يمكن لمسؤول المنصة فقط إدارة نماذج الذكاء الاصطناعي.",
    duplicate: "يوجد ملف نموذج بهذا الاسم بالفعل.",
    inUse: "هذا النموذج مستخدم في سجل المحادثات؛ عطّله بدلاً من حذفه.",
    missing: "هذا النموذج لم يعد موجوداً؛ حدّث الصفحة.",
    limited: "محاولات كثيرة؛ انتظر قليلاً ثم أعد المحاولة.",
    provider:
      "رفض المزود اختبار الاتصال؛ تحقق من مفتاح API ومعرف النموذج والعنوان الأساسي.",
    unavailable: "تشفير بيانات اعتماد الذكاء الاصطناعي غير مهيأ على الخادم.",
  },
} as const;

const roleCopy = {
  en: { user: "You", assistant: "Assistant" },
  fa: { user: "شما", assistant: "دستیار" },
  ar: { user: "أنت", assistant: "المساعد" },
} as const;

const emptyProfileForm = (
  provider: "openai" | "anthropic" = "openai",
): ProfileFormState => ({
  name: "",
  provider,
  modelId: "",
  baseUrl:
    provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://api.anthropic.com",
  apiKey: "",
  inputPricePerMillionUsd: "",
  outputPricePerMillionUsd: "",
});

function formatUsd(value: string | null | undefined, locale: Locale) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(Number(value));
}

function profilePayload(form: ProfileFormState) {
  return {
    ...form,
    inputPricePerMillionUsd: form.inputPricePerMillionUsd.trim() || null,
    outputPricePerMillionUsd: form.outputPricePerMillionUsd.trim() || null,
  };
}

function requestError(
  locale: Locale,
  error: unknown,
  fallback: string,
  operation?: "delete",
) {
  if (!isAxiosError(error)) return fallback;
  const messages = requestErrorCopy[locale];
  switch (error.response?.status) {
    case 400:
      return messages.invalid;
    case 401:
      return messages.unauthorized;
    case 403:
      return messages.forbidden;
    case 404:
      return messages.missing;
    case 409:
      return operation === "delete" ? messages.inUse : messages.duplicate;
    case 429:
      return messages.limited;
    case 502:
      return messages.provider;
    case 503:
      return messages.unavailable;
    default:
      return fallback;
  }
}

function providerErrorFrom(error: unknown): ProviderError | null {
  if (!isAxiosError(error)) return null;
  const value = error.response?.data?.providerError as
    | Partial<ProviderError>
    | undefined;
  return value &&
    typeof value.message === "string" &&
    typeof value.provider === "string"
    ? {
        provider: value.provider,
        statusCode:
          typeof value.statusCode === "number" ? value.statusCode : null,
        code: typeof value.code === "string" ? value.code : null,
        type: typeof value.type === "string" ? value.type : null,
        requestId: typeof value.requestId === "string" ? value.requestId : null,
        message: value.message,
      }
    : null;
}

function secureInputLabels(value: unknown): string[] {
  const labels = new Set<string>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    if (!Array.isArray(item) && Object.keys(item).length === 1 && typeof (item as { $secureInput?: unknown }).$secureInput === "string") {
      labels.add((item as { $secureInput: string }).$secureInput);
      return;
    }
    for (const child of Array.isArray(item) ? item : Object.values(item)) visit(child);
  };
  visit(value);
  return [...labels];
}

function fileInputSpecs(value: unknown): FileInputSpec[] {
  const specs = new Map<string, FileInputSpec>();
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    if (!Array.isArray(item) && Object.keys(item).length === 1) {
      const spec = (item as { $fileInput?: unknown }).$fileInput;
      if (spec && typeof spec === "object" && !Array.isArray(spec) && typeof (spec as FileInputSpec).label === "string") {
        const typed = spec as FileInputSpec;
        specs.set(typed.label, typed);
        return;
      }
    }
    for (const child of Array.isArray(item) ? item : Object.values(item)) visit(child);
  };
  visit(value);
  return [...specs.values()];
}

function resolveBrowserInputs(value: unknown, secureValues: Record<string, string>, files: Record<string, File | null>): unknown {
  if (!value || typeof value !== "object") return value;
  if (!Array.isArray(value) && Object.keys(value).length === 1 && typeof (value as { $secureInput?: unknown }).$secureInput === "string") return secureValues[(value as { $secureInput: string }).$secureInput] ?? "";
  if (!Array.isArray(value) && Object.keys(value).length === 1) {
    const spec = (value as { $fileInput?: unknown }).$fileInput;
    if (spec && typeof spec === "object" && !Array.isArray(spec) && typeof (spec as FileInputSpec).label === "string") return files[(spec as FileInputSpec).label] ?? null;
  }
  if (Array.isArray(value)) return value.map((item) => resolveBrowserInputs(item, secureValues, files));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveBrowserInputs(item, secureValues, files)]));
}

function multipartBody(value: unknown): FormData {
  const form = new FormData();
  if (!value || typeof value !== "object" || Array.isArray(value)) return form;
  for (const [key, item] of Object.entries(value)) {
    if (item instanceof File) form.append(key, item, item.name);
    else if (item !== undefined && item !== null) form.append(key, typeof item === "object" ? JSON.stringify(item) : String(item));
  }
  return form;
}

async function readBoundedResponse(response: Response, limit = 100_000) {
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > limit) { text = text.slice(0, limit); truncated = true; await reader.cancel(); break; }
  }
  return { text: text + decoder.decode(), truncated };
}

async function executeBrowserTool(request: BrowserToolRequest, secureValues: Record<string, string>, files: Record<string, File | null>) {
  const started = performance.now();
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(request.path) || request.path.includes("//") || request.path.includes("\\")) {
    return { ok: false, status: 400, data: { message: "The approved tool path was invalid." }, errorCode: "INVALID_TOOL_PATH", durationMs: 0 };
  }
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(request.query ?? {})) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) query.append(key, String(value));
  }
  const url = `${API_BASE}${request.path}${query.size ? `?${query.toString()}` : ""}`;
  const hasBody = request.body !== undefined && request.method !== "GET";
  const resolvedBody = hasBody ? resolveBrowserInputs(request.body, secureValues, files) : undefined;
  const multipart = fileInputSpecs(request.body).length > 0;
  try {
    const response = await fetch(url, {
      method: request.method,
      credentials: "include",
      headers: {
        ...(hasBody && !multipart ? { "Content-Type": "application/json" } : {}),
        ...(request.idempotencyKey ? { "Idempotency-Key": request.idempotencyKey } : {}),
      },
      body: hasBody ? multipart ? multipartBody(resolvedBody) : JSON.stringify(resolvedBody) : undefined,
    });
    if (request.responseMode === "download" && response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = (response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] ?? "download").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "download";
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      return { ok: true, status: response.status, data: { downloaded: true, filename: anchor.download, bytes: blob.size, contentType: blob.type || null }, durationMs: Math.round(performance.now() - started) };
    }
    const bounded = await readBoundedResponse(response);
    const text = bounded.text;
    let data: unknown = null;
    if (text) {
      try { data = bounded.truncated ? { truncated: true, preview: text } : JSON.parse(text); }
      catch { data = bounded.truncated ? { truncated: true, preview: text } : text; }
    }
    const code = data && typeof data === "object" && !Array.isArray(data) && typeof (data as { code?: unknown }).code === "string" ? (data as { code: string }).code : undefined;
    return { ok: response.ok, status: response.status, data, ...(code ? { errorCode: code.slice(0, 100) } : {}), durationMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, status: 502, data: { message: "The browser could not reach the approved API tool." }, errorCode: "BROWSER_TOOL_NETWORK_ERROR", durationMs: Math.round(performance.now() - started) };
  }
}

const assistantCopy = {
  fa: {
    newChat: "گفت‌وگوی جدید", search: "جست‌وجوی گفت‌وگوها", noHistory: "گفت‌وگوهای شما اینجا ذخیره می‌شوند.", noMatches: "گفت‌وگویی پیدا نشد.",
    title: "از کجا شروع کنیم؟", intro: "از وضعیت فروش بپرسید، سفارش‌ها را بررسی کنید یا کارهای فروشگاه را پیش ببرید.",
    eyebrow: "دستیار مدیریت تاپ جی‌اس‌ام", privacy: "دسترسی و حریم خصوصی", keyboard: "ارسال با Ctrl / ⌘ + Enter", settings: "تنظیم مدل‌ها", close: "بستن تاریخچه",
    prompts: [
      { title: "نبض فروش", detail: "فروش و روند درآمد", prompt: "فروش ۷ روز گذشته را خلاصه کن و با هفته قبل مقایسه کن.", icon: "chart" },
      { title: "پیگیری سفارش‌ها", detail: "سفارش‌های نیازمند بررسی", prompt: "کدام سفارش‌ها هنوز در انتظار رسیدگی هستند؟", icon: "box" },
      { title: "بررسی موجودی", detail: "محصولات رو به اتمام", prompt: "محصولاتی که موجودی کمی دارند را به من نشان بده.", icon: "layers" },
    ],
  },
  en: {
    newChat: "New conversation", search: "Search conversations", noHistory: "Your conversations will appear here.", noMatches: "No conversations found.",
    title: "Where shall we start?", intro: "Explore sales, follow up on orders, or get things done across your store.",
    eyebrow: "TopGSM admin assistant", privacy: "Access & privacy", keyboard: "Ctrl / ⌘ + Enter to send", settings: "Model settings", close: "Close history",
    prompts: [
      { title: "Sales overview", detail: "Revenue and sales trends", prompt: "Summarize sales over the last 7 days and compare with the previous week.", icon: "chart" },
      { title: "Follow up on orders", detail: "Orders that need attention", prompt: "Which orders are still waiting to be processed?", icon: "box" },
      { title: "Check inventory", detail: "Products running low", prompt: "Show me products with low stock.", icon: "layers" },
    ],
  },
  ar: {
    newChat: "محادثة جديدة", search: "البحث في المحادثات", noHistory: "ستظهر محادثاتك هنا.", noMatches: "لم يتم العثور على محادثات.",
    title: "من أين نبدأ؟", intro: "استعرض المبيعات، وتابع الطلبات، وأنجز مهام متجرك.",
    eyebrow: "مساعد إدارة TopGSM", privacy: "الوصول والخصوصية", keyboard: "Ctrl / ⌘ + Enter للإرسال", settings: "إعدادات النماذج", close: "إغلاق السجل",
    prompts: [
      { title: "نظرة على المبيعات", detail: "الإيرادات واتجاهات المبيعات", prompt: "لخص مبيعات آخر ٧ أيام وقارنها بالأسبوع السابق.", icon: "chart" },
      { title: "متابعة الطلبات", detail: "طلبات تحتاج إلى مراجعة", prompt: "ما الطلبات التي لا تزال تنتظر المعالجة؟", icon: "box" },
      { title: "مراجعة المخزون", detail: "منتجات أوشكت على النفاد", prompt: "اعرض المنتجات ذات المخزون المنخفض.", icon: "layers" },
    ],
  },
};

function AssistantIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    chart: "M4 19V5m0 14h16M8 15v-4m5 4V7m5 8v-6",
    box: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7 5l10 4",
    layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
    chat: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2ZM7 9h10M7 13h6",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    plus: "M12 5v14M5 12h14",
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.chat} /></svg>;
}

export function AiWorkspace({ locale, view }: { locale: Locale; view: View }) {
  const c = copy[locale];
  const ui = assistantCopy[locale];
  const [historySearch, setHistorySearch] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyToggleRef = useRef<HTMLButtonElement>(null);
  const historySearchRef = useRef<HTMLInputElement>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [defaultProfileId, setDefaultProfileId] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [conversationCostUsd, setConversationCostUsd] = useState<string | null>(
    "0",
  );
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [pending, setPending] = useState<Evidence | null>(null);
  const [secureValues, setSecureValues] = useState<Record<string, string>>({});
  const [fileValues, setFileValues] = useState<Record<string, File | null>>({});
  const [toolInventory, setToolInventory] = useState({ count: 0, domains: 0 });
  const [question, setQuestion] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providerError, setProviderError] = useState<ProviderError | null>(
    null,
  );
  const [form, setForm] = useState<ProfileFormState>(() => emptyProfileForm());
  const [editingProfileId, setEditingProfileId] = useState("");
  const [editForm, setEditForm] = useState<ProfileFormState>(() =>
    emptyProfileForm(),
  );
  const [confirmingDeleteId, setConfirmingDeleteId] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  async function navigateConversation(action: () => Promise<void>) {
    if (busy || historyBusy) return;
    setHistoryBusy(true);
    try {
      await action();
      setHistoryOpen(false);
    } catch {
      setError(c.error);
    } finally {
      setHistoryBusy(false);
      requestAnimationFrame(() => composerRef.current?.focus());
    }
  }

  const load = useCallback(async () => {
    const [profileResponse, bindingResponse] = await Promise.all([
      api.get<Profile[]>("/ai/model-profiles"),
      api.get<{ profile: Profile | null }>(
        "/ai/capabilities/database_assistant/profile",
      ),
    ]);
    const loadedProfiles = profileResponse.data;
    const defaultId = bindingResponse.data.profile?.id ?? "";
    setProfiles(loadedProfiles);
    setDefaultProfileId(defaultId);
    setSelectedProfileId((current) =>
      loadedProfiles.some(
        (profile) => profile.id === current && profile.status === "active",
      )
        ? current
        : (loadedProfiles.find(
            (profile) =>
              profile.id === defaultId && profile.status === "active",
          )?.id ??
          loadedProfiles.find((profile) => profile.status === "active")?.id ??
          ""),
    );
    if (view === "assistant") {
      const [conversationResponse, toolResponse] = await Promise.all([
        api.get<ConversationSummary[]>("/ai/data/conversations"),
        api.get<Array<{ domain: string }>>("/ai/data/tools"),
      ]);
      setConversations(conversationResponse.data);
      setToolInventory({ count: toolResponse.data.length, domains: new Set(toolResponse.data.map((item) => item.domain)).size });
    }
  }, [view]);
  useEffect(() => {
    setHydrated(true);
  }, []);
  useEffect(() => {
    load().catch(() => setError(c.error));
  }, [c.error, load]);
  useEffect(() => {
    const messageList = messagesRef.current;
    if (messageList) messageList.scrollTop = messageList.scrollHeight;
  }, [activity, evidence, messages]);

  async function openConversation(id: string, preserveActivity = false) {
    setConversationId(id);
    setPending(null);
    setSecureValues({});
    setFileValues({});
    setEvidence([]);
    if (!preserveActivity) setActivity([]);
    setError("");
    const response = await api.get<{
      messages: Message[];
      runs: Array<RunMeta & { tools: Evidence[] }>;
      estimatedCostUsd: string | null;
    }>(`/ai/data/conversations/${id}`);
    const tools = response.data.runs.flatMap((run) => run.tools);
    setMessages(response.data.messages);
    setRuns(response.data.runs);
    setConversationCostUsd(response.data.estimatedCostUsd);
    setEvidence([]);
    setActivity([]);
    setRunMeta(response.data.runs[0] ?? null);
    const pendingTool = tools.find((tool) => tool.status === "proposed" || (tool.status === "running" && tool.approvalType === "browser_tool"));
    if (pendingTool) {
      setPending({ ...pendingTool, executionId: pendingTool.id });
      if (pendingTool.status === "proposed") {
        setSecureValues(Object.fromEntries(secureInputLabels(pendingTool.request?.body).map((label) => [label, ""])));
        setFileValues(Object.fromEntries(fileInputSpecs(pendingTool.request?.body).map((spec) => [spec.label, null])));
      }
    }
  }
  async function createConversation() {
    const response = await api.post<ConversationSummary>(
      "/ai/data/conversations",
      { title: c.newChat },
    );
    await load();
    await openConversation(response.data.id);
  }
  async function deleteConversation() {
    if (!conversationId) return;
    await api.delete(`/ai/data/conversations/${conversationId}`);
    setConversationId("");
    setMessages([]);
    setRuns([]);
    setConversationCostUsd("0");
    setEvidence([]);
    setActivity([]);
    setRunMeta(null);
    setPending(null);
    setSecureValues({});
    setFileValues({});
    await load();
  }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/ai/model-profiles", profilePayload(form));
      setForm({ ...form, name: "", modelId: "", apiKey: "" });
      await load();
    } catch (caught) {
      setError(requestError(locale, caught, c.error));
    } finally {
      setBusy(false);
    }
  }
  async function testProfile(id: string) {
    setBusy(true);
    setError("");
    setProviderError(null);
    try {
      await api.post(`/ai/model-profiles/${id}/test`);
      await load();
    } catch (caught) {
      const exact = providerErrorFrom(caught);
      if (exact) setProviderError(exact);
      else setError(requestError(locale, caught, c.error));
    } finally {
      setBusy(false);
    }
  }
  async function bindProfile(id: string) {
    await api.put("/ai/capabilities/database_assistant/profile", {
      profileId: id,
    });
    setDefaultProfileId(id);
  }
  async function deactivateProfile(id: string) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/ai/model-profiles/${id}/deactivate`);
      await load();
    } catch (caught) {
      setError(requestError(locale, caught, c.error));
    } finally {
      setBusy(false);
    }
  }
  function beginEdit(profile: Profile) {
    setEditingProfileId(profile.id);
    setConfirmingDeleteId("");
    setEditForm({
      name: profile.name,
      provider: profile.provider,
      modelId: profile.modelId,
      baseUrl: profile.baseUrl,
      apiKey: "",
      inputPricePerMillionUsd: profile.inputPricePerMillionUsd ?? "",
      outputPricePerMillionUsd: profile.outputPricePerMillionUsd ?? "",
    });
    setError("");
  }
  function cancelEdit() {
    setEditingProfileId("");
    setEditForm(emptyProfileForm());
  }
  async function updateProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!editingProfileId) return;
    setBusy(true);
    setError("");
    try {
      const {
        provider: _provider,
        apiKey,
        ...profile
      } = profilePayload(editForm);
      void _provider;
      await api.patch(`/ai/model-profiles/${editingProfileId}`, {
        ...profile,
        ...(apiKey ? { apiKey } : {}),
      });
      cancelEdit();
      await load();
    } catch (caught) {
      setError(requestError(locale, caught, c.error));
    } finally {
      setBusy(false);
    }
  }
  async function deleteProfile(id: string) {
    setBusy(true);
    setError("");
    try {
      await api.delete(`/ai/model-profiles/${id}`);
      if (editingProfileId === id) cancelEdit();
      setConfirmingDeleteId("");
      await load();
    } catch (caught) {
      setError(requestError(locale, caught, c.error, "delete"));
    } finally {
      setBusy(false);
    }
  }

  async function consumeStream(
    url: string,
    body?: unknown,
    refreshConversationId = conversationId,
    approvedSecureValues: Record<string, string> = {},
    approvedFiles: Record<string, File | null> = {},
  ) {
    const response = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok || !response.body) throw new Error("stream_failed");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";
    let browserTool: { executionId: string; request: BrowserToolRequest } | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const event = frame.match(/^event: (.+)$/m)?.[1];
        const dataLine = frame.match(/^data: (.+)$/m)?.[1];
        if (!event || !dataLine) continue;
        const data = JSON.parse(dataLine) as Record<string, unknown>;
        if (
          event === "activity" &&
          (data.phase === "planning" || data.phase === "answering") &&
          (data.status === "running" ||
            data.status === "completed" ||
            data.status === "failed")
        ) {
          const next = { phase: data.phase, status: data.status } as Activity;
          setActivity((current) => [
            ...current.filter((item) => item.phase !== next.phase),
            next,
          ]);
        }
        if (event === "text_delta") {
          assistantText += String(data.text ?? "");
          setMessages((current) => [
            ...current.filter((message) => message.id !== "streaming"),
            { id: "streaming", role: "assistant", content: assistantText },
          ]);
        }
        if (event === "tool_started") {
          const tool = String(data.tool ?? "tool");
          const id = String(data.executionId ?? `running-${tool}`);
          setEvidence((current) => [
            ...current.filter(
              (item) =>
                item.id !== id &&
                !(item.name === tool && item.status === "running"),
            ),
            { id, name: tool, status: "running" },
          ]);
        }
        if (event === "tool_result") {
          const id = String(data.executionId ?? "");
          const tool = String(data.tool ?? "tool");
          setEvidence((current) => [
            ...current.filter(
              (item) =>
                item.id !== id &&
                !(item.name === tool && item.status === "running"),
            ),
            { ...(data as Evidence), id, name: tool, status: "completed" },
          ]);
        }
        if (event === "sql_approval_required") {
          setPending(data as Evidence);
          setEvidence((current) => [
            ...current,
            {
              ...(data as Evidence),
              id: String(data.executionId ?? "sql-proposal"),
              name: "generated_reporting_query",
              status: "proposed",
            },
          ]);
        }
        if (event === "tool_approval_required") {
          const next = {
            ...(data as Evidence),
            id: String(data.executionId ?? "tool-proposal"),
            name: String(data.tool ?? "tool"),
            status: "proposed",
            approvalType: "browser_tool" as const,
          };
          setPending(next);
          setSecureValues(Object.fromEntries(secureInputLabels(next.request?.body).map((label) => [label, ""])));
          setFileValues(Object.fromEntries(fileInputSpecs(next.request?.body).map((spec) => [spec.label, null])));
          setEvidence((current) => [
            ...current.filter((item) => item.id !== next.id),
            next,
          ]);
        }
        if (event === "browser_tool_request") {
          const request = data.request;
          if (request && typeof request === "object" && !Array.isArray(request)) {
            browserTool = {
              executionId: String(data.executionId ?? ""),
              request: request as BrowserToolRequest,
            };
          }
        }
        if (event === "continuation_approval_required") {
          const next = {
            ...(data as Evidence),
            id: String(data.executionId ?? "continuation"),
            name: "continuation_checkpoint",
            status: "proposed",
            approvalType: "continuation" as const,
          };
          setPending(next);
          setEvidence((current) => [
            ...current.filter((item) => item.id !== next.id),
            next,
          ]);
        }
        if (
          event === "completed" &&
          data.usage &&
          typeof data.usage === "object"
        )
          setRunMeta({
            provider: selectedProfile?.provider,
            modelId: selectedProfile?.modelId,
            ...(data.usage as object),
            durationMs: Number(data.durationMs) || null,
          });
        if (event === "failed") throw new AiRunError(String(data.code));
      }
      if (done) break;
    }
    if (browserTool) {
      const approvedTool = browserTool as { executionId: string; request: BrowserToolRequest };
      const result = await executeBrowserTool(approvedTool.request, approvedSecureValues, approvedFiles);
      await consumeStream(
        `/ai/data/query-executions/${approvedTool.executionId}/result`,
        result,
        refreshConversationId,
        {},
        {},
      );
      return;
    }
    if (refreshConversationId)
      await openConversation(refreshConversationId, true);
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy || historyBusy || pending || !selectedProfileId) return;
    setBusy(true);
    setError("");
    try {
      let id = conversationId;
      if (!id) {
        const response = await api.post<ConversationSummary>(
          "/ai/data/conversations",
          { title: text.slice(0, 160) },
        );
        id = response.data.id;
        setConversationId(id);
      }
      setMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: "user", content: text },
      ]);
      setEvidence([]);
      setActivity([]);
      setRunMeta(null);
      setQuestion("");
        await consumeStream(
        `/ai/data/conversations/${id}/messages`,
        { question: text, profileId: selectedProfileId },
        id,
      );
      await load();
    } catch (caught) {
      setActivity((current) =>
        current.map((item) =>
          item.status === "running" ? { ...item, status: "failed" } : item,
        ),
      );
      setEvidence((current) =>
        current.map((item) =>
          item.status === "running" ? { ...item, status: "failed" } : item,
        ),
      );
      setError(aiRunErrorMessage(caught, locale, c.error));
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!pending?.executionId) return;
    const executionId = pending.executionId;
    const approvedSecureValues = secureValues;
    const approvedFiles = fileValues;
    setPending(null);
    setSecureValues({});
    setFileValues({});
    setBusy(true);
    setError("");
    try {
      await consumeStream(
        `/ai/data/query-executions/${executionId}/approve`,
        undefined,
        conversationId,
        approvedSecureValues,
        approvedFiles,
      );
    } catch (caught) {
      setActivity((current) =>
        current.map((item) =>
          item.status === "running" ? { ...item, status: "failed" } : item,
        ),
      );
      setEvidence((current) =>
        current.map((item) =>
          item.status === "running" ? { ...item, status: "failed" } : item,
        ),
      );
      setError(aiRunErrorMessage(caught, locale, c.error));
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    if (!pending?.executionId) return;
    await api.post(`/ai/data/query-executions/${pending.executionId}/reject`);
    setPending(null);
    setSecureValues({});
    setFileValues({});
    if (conversationId) await openConversation(conversationId);
  }
  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.status === "active"),
    [profiles],
  );
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId),
    [profiles, selectedProfileId],
  );
  const runsByOutputMessage = useMemo(
    () =>
      new Map(
        runs
          .filter((run) => run.outputMessageId)
          .map((run) => [run.outputMessageId!, run]),
      ),
    [runs],
  );
  const unfinishedRunsByInputMessage = useMemo(
    () =>
      new Map(
        runs
          .filter((run) => !run.outputMessageId && run.inputMessageId)
          .map((run) => [run.inputMessageId!, run]),
      ),
    [runs],
  );

  if (view === "models")
    return (
      <section className={styles.workspace} aria-labelledby="ai-models-title">
        <header className={styles.header}>
          <div>
            <h1 id="ai-models-title">{c.modelsTitle}</h1>
            <p>{c.modelsIntro}</p>
          </div>
          <span>
            {profiles.length
              ? `${profiles.length} · ${c.profiles}`
              : c.noProfiles}
          </span>
        </header>
        {providerError ? (
          <ProviderErrorPanel error={providerError} />
        ) : error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <AuthoringModelBindings locale={locale} profiles={profiles} />
        <div className={styles.modelsLayout}>
          <aside className={styles.profiles}>
            <h2>{c.save}</h2>
            <ProfileForm
              c={c}
              form={form}
              setForm={setForm}
              busy={busy}
              onSubmit={saveProfile}
            />
          </aside>
          <main className={styles.savedModels}>
            <h2>{c.profiles}</h2>
            {profiles.length ? (
              <div className={styles.profileList}>
                {profiles.map((profile) => (
                  <article key={profile.id}>
                    <div className={styles.profileInfo}>
                      <strong>{profile.name}</strong>
                      <span>
                        {profile.provider} · {profile.modelId} · ••••
                        {profile.apiKeyHint}
                      </span>
                      <small dir="ltr">{profile.baseUrl}</small>
                      <small dir="ltr">
                        {c.pricing}:{" "}
                        {profile.inputPricePerMillionUsd === null
                          ? "—"
                          : `${formatUsd(profile.inputPricePerMillionUsd, locale)} IN · ${formatUsd(profile.outputPricePerMillionUsd, locale)} OUT / 1M`}
                      </small>
                    </div>
                    <i data-status={profile.status}>
                      {c.status[profile.status]}
                    </i>
                    <div className={styles.profileActions}>
                      <button
                        type="button"
                        onClick={() => beginEdit(profile)}
                        disabled={busy || editingProfileId === profile.id}
                      >
                        {c.editModel}
                      </button>
                      <button
                        className={styles.dangerAction}
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteId(profile.id);
                          setEditingProfileId("");
                        }}
                        disabled={busy}
                      >
                        {c.deleteModel}
                      </button>
                      <button
                        type="button"
                        onClick={() => testProfile(profile.id)}
                        disabled={busy}
                      >
                        {c.test}
                      </button>
                      <button
                        type="button"
                        onClick={() => bindProfile(profile.id)}
                        disabled={
                          busy ||
                          profile.status !== "active" ||
                          defaultProfileId === profile.id
                        }
                      >
                        {defaultProfileId === profile.id ? c.active : c.use}
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateProfile(profile.id)}
                        disabled={busy || profile.status === "inactive"}
                      >
                        {c.deactivate}
                      </button>
                    </div>
                    {editingProfileId === profile.id ? (
                      <EditProfileForm
                        c={c}
                        form={editForm}
                        setForm={setEditForm}
                        busy={busy}
                        onSubmit={updateProfile}
                        onCancel={cancelEdit}
                      />
                    ) : null}
                    {confirmingDeleteId === profile.id ? (
                      <div className={styles.deleteConfirm} role="alert">
                        <p>
                          {c.deleteModelConfirm.replace("{name}", profile.name)}
                        </p>
                        <div>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId("")}
                            disabled={busy}
                          >
                            {c.cancel}
                          </button>
                          <button
                            className={styles.dangerAction}
                            type="button"
                            onClick={() => deleteProfile(profile.id)}
                            disabled={busy}
                          >
                            {c.deleteModel}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyList}>{c.noProfiles}</p>
            )}
          </main>
        </div>
      </section>
    );

  return (
    <section
      className={`${styles.workspace} ${styles.assistantWorkspace}`}
      aria-label={c.assistantTitle}
    >
      <div className={styles.assistantLayout}>
        <aside className={styles.history} data-open={historyOpen} id="assistant-history" onKeyDown={(event) => { if (event.key === "Escape" && historyOpen) { setHistoryOpen(false); requestAnimationFrame(() => historyToggleRef.current?.focus()); } }}>
          <div className={styles.asideTitle}>
            <div className={styles.historyHeading}><h2>{c.history}</h2><button className={styles.closeHistory} type="button" onClick={() => { setHistoryOpen(false); requestAnimationFrame(() => historyToggleRef.current?.focus()); }} aria-label={ui.close}>×</button></div>
            <button type="button" disabled={busy || historyBusy} onClick={() => navigateConversation(createConversation)}>
              <AssistantIcon name="plus" /> {ui.newChat}
            </button>
          </div>
          <label className={styles.historySearch}><AssistantIcon name="search" /><input ref={historySearchRef} type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder={ui.search} aria-label={ui.search} /></label>
          <nav aria-label={c.history}>
            {!conversations.length ? <p className={styles.historyEmpty}>{ui.noHistory}</p> : null}
            {conversations.length > 0 && !conversations.some((item) => item.title.toLocaleLowerCase(locale).includes(historySearch.trim().toLocaleLowerCase(locale))) ? <p className={styles.historyEmpty}>{ui.noMatches}</p> : null}
            {conversations.filter((item) => item.title.toLocaleLowerCase(locale).includes(historySearch.trim().toLocaleLowerCase(locale))).map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={busy || historyBusy}
                aria-current={
                  conversation.id === conversationId ? "page" : undefined
                }
                onClick={() => navigateConversation(() => openConversation(conversation.id))}
              >
                <strong>{conversation.title}</strong>
                <time dateTime={conversation.updatedAt}>
                  {new Date(conversation.updatedAt).toLocaleDateString(locale)}{" "}
                  · {formatUsd(conversation.estimatedCostUsd, locale)}
                </time>
              </button>
            ))}
          </nav>
          {conversationId ? (
            <button
              className={styles.delete}
              type="button"
              disabled={busy || historyBusy}
              onClick={() => navigateConversation(deleteConversation)}
            >
              {c.delete}
            </button>
          ) : null}
        </aside>
        <main className={styles.chat} aria-busy={busy}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}><span className={styles.assistantMark}><AssistantIcon name="chat" /></span><div><h1>{c.assistantTitle}</h1><p>{ui.eyebrow}</p></div></div>
            <button ref={historyToggleRef} className={styles.historyToggle} type="button" aria-expanded={historyOpen} aria-controls="assistant-history" onClick={() => { setHistoryOpen(true); requestAnimationFrame(() => historySearchRef.current?.focus()); }}><AssistantIcon name="chat" /><span>{c.history}</span></button>
            <a className={styles.settingsLink} href={`/${locale}/admin/ai/models`}>{ui.settings}<span aria-hidden="true">↗</span></a>
          </header>
          <div className={styles.messages} ref={messagesRef}>
            {runMeta ? (
              <div className={styles.runMeta}>
                <strong>
                  {runMeta.provider} · {runMeta.modelId}
                </strong>
                <span>
                  {c.chatTotal}: {formatUsd(conversationCostUsd, locale)} · IN{" "}
                  {runMeta.inputTokens ?? "—"} · OUT{" "}
                  {runMeta.outputTokens ?? "—"} · {runMeta.durationMs ?? "—"} ms
                </span>
              </div>
            ) : null}
            {messages.length ? (
              <>
                {messages.map((message) => {
                  const responseRun =
                    message.role === "assistant"
                      ? runsByOutputMessage.get(message.id)
                      : undefined;
                  const unfinishedRun =
                    message.role === "user"
                      ? unfinishedRunsByInputMessage.get(message.id)
                      : undefined;
                  const isStreaming = message.id === "streaming";
                  return (
                    <Fragment key={message.id}>
                      {isStreaming && (activity.length || evidence.length) ? (
                        <AgentTrace
                          activity={activity}
                          tools={evidence}
                          busy={busy}
                          c={c}
                          locale={locale}
                        />
                      ) : responseRun ? (
                        <AgentTrace
                          run={responseRun}
                          tools={responseRun.tools ?? []}
                          busy={false}
                          c={c}
                          locale={locale}
                        />
                      ) : null}
                      <article data-role={message.role}>
                        <span>{roleCopy[locale][message.role]}</span>
                        {message.role === "assistant" ? (
                          <MarkdownMessage content={message.content} />
                        ) : (
                          <p>{message.content}</p>
                        )}
                        <MessageResults
                          content={message.structuredContent}
                          title={c.rows}
                          empty={c.noRows}
                        />
                        {message.structuredContent?.chart ? (
                          <AccessibleChart
                            rows={message.structuredContent.rows ?? []}
                            spec={message.structuredContent.chart}
                          />
                        ) : null}
                        {responseRun ? (
                          <small className={styles.messageCost}>
                            {c.responseCost}:{" "}
                            {formatUsd(responseRun.estimatedCostUsd, locale)}
                          </small>
                        ) : null}
                      </article>
                      {unfinishedRun ? (
                        <AgentTrace
                          run={unfinishedRun}
                          tools={unfinishedRun.tools ?? []}
                          busy={false}
                          c={c}
                          locale={locale}
                        />
                      ) : null}
                    </Fragment>
                  );
                })}
                {!messages.some((message) => message.id === "streaming") &&
                (activity.length || evidence.length) ? (
                  <AgentTrace
                    activity={activity}
                    tools={evidence}
                    busy={busy}
                    c={c}
                    locale={locale}
                  />
                ) : null}
              </>
            ) : (
              <div className={styles.empty}>
                <span className={styles.welcomeMark}><AssistantIcon name="chat" /></span>
                <h2>{ui.title}</h2>
                <p>{selectedProfile ? ui.intro : c.configure}</p>
                {selectedProfile ? <div className={styles.suggestions}>{ui.prompts.map((item) => <button type="button" key={item.icon} disabled={busy || historyBusy || Boolean(pending)} onClick={() => { setQuestion(item.prompt); composerRef.current?.focus(); }}><AssistantIcon name={item.icon} /><strong>{item.title}</strong><span>{item.detail}</span><b aria-hidden="true">↗</b></button>)}</div> : <a className={styles.setupLink} href={`/${locale}/admin/ai/models`}>{ui.settings}<span aria-hidden="true">↗</span></a>}
              </div>
            )}
          </div>
          <div className={styles.chatFooter}>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            {pending ? (
              <section className={styles.approval}>
                <h2>
                  {pending.status === "running" && pending.approvalType === "browser_tool"
                    ? c.toolRunningTitle
                    : pending.approvalType === "continuation"
                    ? c.continuationTitle
                    : pending.approvalType === "browser_tool"
                      ? c.toolTitle
                      : c.sqlTitle}
                </h2>
                <div className={styles.approvalDetails}>
                  <p>{pending.purpose}</p>
                  {pending.sql ? <pre dir="ltr">{pending.sql}</pre> : null}
                  {pending.request ? (
                    <pre dir="ltr">
                      {JSON.stringify(
                        {
                          risk: pending.request.risk,
                          method: pending.request.method,
                          path: pending.request.path,
                          query: pending.request.query,
                          body: pending.request.body,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  ) : null}
                  {Object.keys(secureValues).map((label) => (
                    <label className={styles.secureInput} key={label}>
                      <span>{label}</span>
                      <input type="password" autoComplete="off" value={secureValues[label]} onChange={(event) => setSecureValues((current) => ({ ...current, [label]: event.target.value }))} />
                    </label>
                  ))}
                  {fileInputSpecs(pending.request?.body).map((spec) => (
                    <label className={styles.secureInput} key={spec.label}>
                      <span>{spec.label} · ≤ {(spec.maxBytes / 1_048_576).toLocaleString(locale, { maximumFractionDigits: 1 })} MB</span>
                      <input type="file" accept={spec.accept} onChange={(event) => setFileValues((current) => ({ ...current, [spec.label]: event.target.files?.[0] ?? null }))} />
                    </label>
                  ))}
                </div>
                <div className={styles.approvalActions}>
                  {pending.status !== "running" ? (
                    <button type="button" onClick={approve} disabled={busy || Object.values(secureValues).some((value) => !value) || fileInputSpecs(pending.request?.body).some((spec) => !fileValues[spec.label] || fileValues[spec.label]!.size > spec.maxBytes)}>
                      {c.approve}
                    </button>
                  ) : null}
                  <button type="button" onClick={reject} disabled={busy}>
                    {c.reject}
                  </button>
                </div>
              </section>
            ) : null}
            <form className={styles.composer} onSubmit={ask} aria-busy={busy}>
              <label>
                <span className={styles.composerLabel}>{c.assistantTitle}</span>
                <textarea
                  ref={composerRef}
                  rows={3}
                  maxLength={4000}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                  placeholder={c.question}
                  aria-disabled={!hydrated || busy || historyBusy || Boolean(pending) || !selectedProfileId}
                  disabled={hydrated ? busy || historyBusy || Boolean(pending) || !selectedProfileId : undefined}
                />
              </label>
              <div className={styles.composerBar}>
                <ModelPicker
                  profiles={activeProfiles}
                  selectedProfileId={selectedProfileId}
                  defaultProfileId={defaultProfileId}
                  hydrated={hydrated}
                  disabled={busy}
                  label={c.selectModel}
                  emptyLabel={c.configure}
                  defaultLabel={c.active}
                  onSelect={setSelectedProfileId}
                />
                <button
                  className={styles.sendButton}
                  type="submit"
                  aria-disabled={
                    !hydrated || busy || historyBusy || Boolean(pending) || !question.trim() || !selectedProfileId
                  }
                  disabled={
                    hydrated
                      ? busy || historyBusy || Boolean(pending) || !question.trim() || !selectedProfileId
                      : undefined
                  }
                >
                  <span>{busy ? c.working : c.send}</span>
                  {busy ? (
                    <span className={styles.sendSpinner} aria-hidden="true" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5m-6 6 6-6 6 6" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
            <div className={styles.composerHelp}><details className={styles.toolDisclosure}><summary>{ui.privacy}</summary><p>{toolInventory.count.toLocaleString(locale)} {c.toolsAvailable} {toolInventory.domains.toLocaleString(locale)} {c.toolDomains}. {c.disclosure}</p></details><span>{ui.keyboard}</span></div>
          </div>
        </main>
      </div>
    </section>
  );
}

function ModelPicker({
  profiles,
  selectedProfileId,
  defaultProfileId,
  hydrated,
  disabled,
  label,
  emptyLabel,
  defaultLabel,
  onSelect,
}: {
  profiles: Profile[];
  selectedProfileId: string;
  defaultProfileId: string;
  hydrated: boolean;
  disabled: boolean;
  label: string;
  emptyLabel: string;
  defaultLabel: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const selectedProfile = profiles.find(
    (profile) => profile.id === selectedProfileId,
  );

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open)
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-model-index="${activeIndex}"]`)
        ?.focus();
  }, [activeIndex, open]);

  function moveFocus(direction: 1 | -1) {
    if (!profiles.length) return;
    setActiveIndex(
      (current) => (current + direction + profiles.length) % profiles.length,
    );
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(
          Math.max(
            0,
            profiles.findIndex((profile) => profile.id === selectedProfileId),
          ),
        );
        setOpen(true);
      } else moveFocus(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  function toggle() {
    if (!open)
      setActiveIndex(
        Math.max(
          0,
          profiles.findIndex((profile) => profile.id === selectedProfileId),
        ),
      );
    setOpen((current) => !current);
  }

  function selectProfile(id: string) {
    onSelect(id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const state = disabled ? "loading" : !selectedProfile ? "error" : "success";
  return (
    <div
      className={styles.modelPicker}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      data-state={state}
    >
      <button
        className={styles.modelTrigger}
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${selectedProfile?.name ?? emptyLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-busy={disabled}
        aria-disabled={!hydrated || disabled || !profiles.length}
        disabled={hydrated ? disabled || !profiles.length : undefined}
        onClick={toggle}
      >
        <span className={styles.modelDot} aria-hidden="true" />
        <span className={styles.selectedModel}>
          <strong><bdi>{selectedProfile?.name ?? emptyLabel}</bdi></strong>
        </span>
        <span className={styles.modelChevron} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className={styles.modelMenu}
          id={listboxId}
          role="listbox"
          aria-label={label}
        >
          <p>{label}</p>
          {profiles.map((profile, index) => {
            const selected = profile.id === selectedProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-model-index={index}
                onClick={() => selectProfile(profile.id)}
              >
                <span
                  className={styles.providerMark}
                  data-provider={profile.provider}
                  aria-hidden="true"
                >
                  {profile.provider === "anthropic" ? "A" : "O"}
                </span>
                <span>
                  <strong>{profile.name}</strong>
                  <small dir="ltr">
                    {profile.provider} · {profile.modelId}
                  </small>
                </span>
                <span className={styles.modelStatus}>
                  {profile.id === defaultProfileId ? defaultLabel : null}
                  {selected ? (
                    <span className={styles.modelCheck} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AgentTrace({
  activity = [],
  tools,
  run,
  busy,
  c,
  locale,
}: {
  activity?: Activity[];
  tools: Evidence[];
  run?: RunMeta;
  busy: boolean;
  c: (typeof copy)[keyof typeof copy];
  locale: Locale;
}) {
  const label = (value: string | undefined) =>
    value
      ? value
          .replaceAll("_", " ")
          .replace(/^\w/, (letter) => letter.toUpperCase())
      : c.toolCall;
  const awaitingApproval =
    tools.some((item) => item.status === "proposed") ||
    run?.status === "awaiting_approval";
  const failed =
    run?.status === "failed" ||
    activity.some((item) => item.status === "failed") ||
    tools.some((item) => item.status === "failed");
  const summary = busy
    ? c.activityLive
    : awaitingApproval
      ? c.status.proposed
      : failed
        ? c.status.failed
        : `${c.activityComplete}${run?.durationMs ? ` · ${(run.durationMs / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })}s` : ""}`;
  const phases = activity.length
    ? activity
    : ([
        { phase: "planning", status: "completed" },
        ...(run?.outputMessageId
          ? [
              {
                phase: "answering",
                status: run.status === "failed" ? "failed" : "completed",
              },
            ]
          : []),
      ] as Activity[]);
  return (
    <details
      className={styles.activity}
      open={busy || awaitingApproval || undefined}
    >
      <summary aria-label={`${c.activityTitle}: ${summary}`}>
        <span className={styles.traceChevron} aria-hidden="true" />
        <strong>{summary}</strong>
        <span>
          {tools.length ? `${c.toolCall} · ${tools.length}` : c.planning}
        </span>
      </summary>
      <ol aria-live={busy ? "polite" : "off"}>
        {phases
          .filter((item) => item.phase === "planning")
          .map((item) => (
            <li key={item.phase} data-status={item.status}>
              <i aria-hidden="true" />
              <div>
                <strong>{c.planning}</strong>
                <span>{c.status[item.status]}</span>
              </div>
            </li>
          ))}
        {tools.map((item, index) => (
          <li
            key={item.id ?? `${item.name}-${index}`}
            data-status={item.status ?? "completed"}
          >
            <i aria-hidden="true" />
            <div>
              <strong>
                {c.toolCall} · {label(item.name)}
              </strong>
              <span>
                {c.status[item.status as keyof typeof c.status] ?? item.status}
                {typeof item.rowCount === "number"
                  ? ` · ${item.rowCount} ${c.rows.toLocaleLowerCase()}`
                  : ""}
                {typeof item.durationMs === "number"
                  ? ` · ${item.durationMs} ms`
                  : ""}
              </span>
              {item.sql || item.purpose || item.request ? (
                <details className={styles.toolDetails}>
                  <summary>{item.request ? `${item.request.method} ${item.request.path}` : item.sql ? "SQL" : c.toolCall}</summary>
                  {item.purpose ? <p>{item.purpose}</p> : null}
                  {item.sql ? <pre dir="ltr">{item.sql}</pre> : null}
                  {item.request ? <pre dir="ltr">{JSON.stringify({ risk: item.request.risk, query: item.request.query, body: item.request.body }, null, 2)}</pre> : null}
                </details>
              ) : null}
            </div>
          </li>
        ))}
        {phases
          .filter((item) => item.phase === "answering")
          .map((item) => (
            <li key={item.phase} data-status={item.status}>
              <i aria-hidden="true" />
              <div>
                <strong>{c.answering}</strong>
                <span>{c.status[item.status]}</span>
              </div>
            </li>
          ))}
      </ol>
    </details>
  );
}

function ProviderErrorPanel({ error }: { error: ProviderError }) {
  return (
    <section className={styles.providerError} role="alert" dir="ltr">
      <strong>Provider error</strong>
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>{error.provider}</dd>
        </div>
        <div>
          <dt>HTTP status</dt>
          <dd>{error.statusCode ?? "—"}</dd>
        </div>
        {error.code ? (
          <div>
            <dt>Code</dt>
            <dd>{error.code}</dd>
          </div>
        ) : null}
        {error.type ? (
          <div>
            <dt>Type</dt>
            <dd>{error.type}</dd>
          </div>
        ) : null}
        {error.requestId ? (
          <div>
            <dt>Request ID</dt>
            <dd>{error.requestId}</dd>
          </div>
        ) : null}
      </dl>
      <pre>{error.message}</pre>
    </section>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className={styles.markdown} dir="auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ node, ...props }) => {
            void node;
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
          code: ({ node, ...props }) => {
            void node;
            return <code {...props} dir="ltr" />;
          },
          img: () => null,
          pre: ({ node, ...props }) => {
            void node;
            return <pre {...props} dir="ltr" />;
          },
          table: ({ node, ...props }) => {
            void node;
            return (
              <div className={styles.markdownTable} dir="ltr">
                <table {...props} />
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ProfileForm({
  c,
  form,
  setForm,
  busy,
  onSubmit,
}: {
  c: (typeof copy)[keyof typeof copy];
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}) {
  return (
    <form onSubmit={onSubmit}>
      <label>
        {c.name}
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        {c.provider}
        <select
          value={form.provider}
          onChange={(event) => {
            const provider = event.target.value as "openai" | "anthropic";
            setForm({
              ...form,
              provider,
              baseUrl:
                provider === "openai"
                  ? "https://api.openai.com/v1"
                  : "https://api.anthropic.com",
            });
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      <label>
        {c.model}
        <input
          required
          maxLength={200}
          dir="ltr"
          value={form.modelId}
          onChange={(event) =>
            setForm({ ...form, modelId: event.target.value })
          }
        />
      </label>
      <label>
        {c.url}
        <input
          required
          maxLength={500}
          type="url"
          dir="ltr"
          value={form.baseUrl}
          onChange={(event) =>
            setForm({ ...form, baseUrl: event.target.value })
          }
        />
      </label>
      <PricingFields c={c} form={form} setForm={setForm} />
      <label>
        {c.key}
        <input
          required
          minLength={8}
          maxLength={2000}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={form.apiKey}
          onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
        />
        <small>{c.profileHint}</small>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? c.saving : c.save}
      </button>
    </form>
  );
}

function EditProfileForm({
  c,
  form,
  setForm,
  busy,
  onSubmit,
  onCancel,
}: {
  c: (typeof copy)[keyof typeof copy];
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  busy: boolean;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form className={styles.editProfileForm} onSubmit={onSubmit}>
      <label>
        {c.name}
        <input
          required
          maxLength={100}
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />
      </label>
      <label>
        {c.provider}
        <input
          value={form.provider === "openai" ? "OpenAI" : "Anthropic"}
          disabled
        />
      </label>
      <label>
        {c.model}
        <input
          required
          maxLength={200}
          dir="ltr"
          value={form.modelId}
          onChange={(event) =>
            setForm({ ...form, modelId: event.target.value })
          }
        />
      </label>
      <label>
        {c.url}
        <input
          required
          maxLength={500}
          type="url"
          dir="ltr"
          value={form.baseUrl}
          onChange={(event) =>
            setForm({ ...form, baseUrl: event.target.value })
          }
        />
      </label>
      <PricingFields c={c} form={form} setForm={setForm} />
      <label>
        {c.replacementKey}
        <input
          minLength={8}
          maxLength={2000}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          value={form.apiKey}
          onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
        />
        <small>{c.replacementKeyHint}</small>
      </label>
      <div className={styles.editActions}>
        <button type="button" onClick={onCancel} disabled={busy}>
          {c.cancel}
        </button>
        <button type="submit" disabled={busy}>
          {busy ? c.saving : c.saveChanges}
        </button>
      </div>
    </form>
  );
}

function PricingFields({
  c,
  form,
  setForm,
}: {
  c: (typeof copy)[keyof typeof copy];
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
}) {
  return (
    <>
      <label>
        {c.inputPrice}
        <input
          min="0"
          max="999999.99999999"
          step="0.00000001"
          inputMode="decimal"
          type="number"
          dir="ltr"
          value={form.inputPricePerMillionUsd}
          onChange={(event) =>
            setForm({ ...form, inputPricePerMillionUsd: event.target.value })
          }
        />
      </label>
      <label>
        {c.outputPrice}
        <input
          min="0"
          max="999999.99999999"
          step="0.00000001"
          inputMode="decimal"
          type="number"
          dir="ltr"
          value={form.outputPricePerMillionUsd}
          onChange={(event) =>
            setForm({ ...form, outputPricePerMillionUsd: event.target.value })
          }
        />
        <small>{c.pricingHint}</small>
      </label>
    </>
  );
}

function ResultTable({
  rows,
  title,
  empty,
}: {
  rows: Record<string, unknown>[];
  title: string;
  empty: string;
}) {
  if (!rows.length) return <p>{empty}</p>;
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function MessageResults({
  content,
  title,
  empty,
}: {
  content: Message["structuredContent"];
  title: string;
  empty: string;
}) {
  if (content?.toolResults?.length)
    return (
      <>
        {content.toolResults.map((result, index) => (
          <ResultTable
            key={`${result.tool}-${index}`}
            rows={result.rows}
            title={`${title} · ${result.tool.replaceAll("_", " ")}`}
            empty={empty}
          />
        ))}
      </>
    );
  return content?.rows ? (
    <ResultTable rows={content.rows} title={title} empty={empty} />
  ) : null;
}
function AccessibleChart({
  rows,
  spec,
}: {
  rows: Record<string, unknown>[];
  spec: ChartSpec;
}) {
  const values = rows.flatMap((row) =>
    spec.yKeys.map((key) => Number(row[key]) || 0),
  );
  const max =
    spec.type === "stacked-bar"
      ? Math.max(
          ...rows.map((row) =>
            spec.yKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0),
          ),
          1,
        )
      : Math.max(...values, 1);
  const width = Math.max(rows.length * 56, 320);
  if (spec.type === "line")
    return (
      <figure className={styles.chart}>
        <figcaption>{spec.title}</figcaption>
        <svg viewBox={`0 0 ${width} 220`} role="img" aria-label={spec.title}>
          {spec.yKeys.map((key, series) => (
            <polyline
              key={key}
              points={rows
                .map(
                  (row, index) =>
                    `${index * 56 + 28},${185 - ((Number(row[key]) || 0) / max) * 160}`,
                )
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              opacity={1 - series * 0.22}
            >
              <title>{key}</title>
            </polyline>
          ))}
        </svg>
        <ResultTable rows={rows} title={spec.title} empty="" />
      </figure>
    );
  return (
    <figure className={styles.chart}>
      <figcaption>{spec.title}</figcaption>
      <svg viewBox={`0 0 ${width} 220`} role="img" aria-label={spec.title}>
        {rows.map((row, index) => {
          let stackedHeight = 0;
          return spec.yKeys.map((key, series) => {
            const value = Number(row[key]) || 0;
            const height = (value / max) * 160;
            const y =
              185 - height - (spec.type === "stacked-bar" ? stackedHeight : 0);
            if (spec.type === "stacked-bar") stackedHeight += height;
            return (
              <rect
                key={`${index}-${key}`}
                x={
                  index * 56 +
                  (spec.type === "stacked-bar" ? 22 : series * 12 + 22)
                }
                y={y}
                width={spec.type === "stacked-bar" ? 30 : 10}
                height={height}
                rx="2"
                opacity={1 - series * 0.2}
              >
                <title>{`${String(row[spec.xKey])}: ${key} ${value}`}</title>
              </rect>
            );
          });
        })}
      </svg>
      <ResultTable rows={rows} title={spec.title} empty="" />
    </figure>
  );
}
