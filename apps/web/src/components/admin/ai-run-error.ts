import type { Locale } from "@/lib/i18n";

const messages: Record<string, Record<Locale, string>> = {
  AI_TIMEOUT: {
    en: "The AI provider took too long to respond. Try again or choose another model.",
    fa: "پاسخ سرویس هوش مصنوعی بیش از حد طول کشید. دوباره تلاش کنید یا مدل دیگری انتخاب کنید.",
    ar: "استغرق رد خدمة الذكاء الاصطناعي وقتًا طويلًا. حاول مجددًا أو اختر نموذجًا آخر.",
  },
  AI_PROVIDER_AUTH: {
    en: "The AI provider rejected authentication. Check the model’s API key and access permissions.",
    fa: "سرویس هوش مصنوعی دسترسی را تأیید نکرد. کلید API و مجوزهای مدل را بررسی کنید.",
    ar: "رفضت خدمة الذكاء الاصطناعي المصادقة. تحقق من مفتاح API وصلاحيات النموذج.",
  },
  AI_RATE_LIMITED: {
    en: "The AI provider’s request or quota limit was reached. Check your quota or try again later.",
    fa: "به سقف درخواست یا سهمیهٔ سرویس هوش مصنوعی رسیدید. سهمیه را بررسی کنید یا کمی بعد دوباره تلاش کنید.",
    ar: "تم بلوغ حد الطلبات أو حصة خدمة الذكاء الاصطناعي. تحقق من حصتك أو حاول لاحقًا.",
  },
  AI_PROVIDER_UNAVAILABLE: {
    en: "The AI provider could not be reached or returned a server error. Try again shortly.",
    fa: "ارتباط با سرویس هوش مصنوعی برقرار نشد یا سرویس خطا داد. کمی بعد دوباره تلاش کنید.",
    ar: "تعذر الاتصال بخدمة الذكاء الاصطناعي أو أعادت خطأ في الخادم. حاول بعد قليل.",
  },
  AI_PROVIDER_REJECTED: {
    en: "The AI provider rejected the request. Check the model name and provider URL in model settings.",
    fa: "سرویس هوش مصنوعی درخواست را نپذیرفت. نام مدل و آدرس سرویس را در تنظیمات مدل بررسی کنید.",
    ar: "رفضت خدمة الذكاء الاصطناعي الطلب. تحقق من اسم النموذج وعنوان الخدمة في إعدادات النموذج.",
  },
};

export class AiRunError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function aiRunErrorMessage(error: unknown, locale: Locale, fallback: string): string {
  return error instanceof AiRunError && Object.hasOwn(messages, error.code) ? messages[error.code][locale] : fallback;
}
