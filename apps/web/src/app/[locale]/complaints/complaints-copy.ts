import type { Locale } from "@/lib/i18n";

export const complaintsCopy = {
  fa: {
    title: "ثبت شکایات",
    home: "صفحه اصلی",
    label: "رسیدگی به شکایات",
    heading: "ثبت شکایت در",
    brand: "تاپ جی‌اس‌ام",
    description: "اگر از خرید، پشتیبانی یا خدمات مجموعه ناراضی هستید، از طریق شماره تماس یا تلگرام زیر با واحد رسیدگی به شکایات در ارتباط باشید.",
    contacts: "راه‌های ثبت شکایت",
    contactsBody: "یکی از راه‌های زیر را انتخاب کنید و جزئیات شکایت خود را ارسال کنید.",
    phone: "شماره تماس",
    telegram: "تلگرام",
    call: "تماس تلفنی",
    openTelegram: "گفت‌وگو در تلگرام",
    empty: "راه‌های ثبت شکایت هنوز تنظیم نشده‌اند. کمی بعد دوباره سر بزنید یا از صفحه تماس با ما استفاده کنید.",
    contactUs: "تماس با ما",
    unavailable: "اطلاعات شکایات بارگذاری نشد. کمی بعد دوباره تلاش کنید.",
    skip: "رفتن به محتوای اصلی"
  },
  en: {
    title: "Complaints",
    home: "Home",
    label: "Complaint handling",
    heading: "File a complaint with",
    brand: "Top GSM",
    description: "If you are unhappy with a purchase, support, or our services, contact the complaints team by phone or Telegram using the details below.",
    contacts: "How to file a complaint",
    contactsBody: "Choose one of the channels below and share the details of your complaint.",
    phone: "Phone number",
    telegram: "Telegram",
    call: "Call",
    openTelegram: "Open Telegram",
    empty: "Complaint contacts are not set yet. Check back later or use the contact page.",
    contactUs: "Contact us",
    unavailable: "Complaint details could not be loaded. Please try again later.",
    skip: "Skip to content"
  },
  ar: {
    title: "تقديم شكوى",
    home: "الرئيسية",
    label: "معالجة الشكاوى",
    heading: "قدّم شكوى لدى",
    brand: "تاپ جي إس إم",
    description: "إذا لم تكن راضياً عن عملية شراء أو الدعم أو خدماتنا، تواصل مع وحدة الشكاوى عبر الهاتف أو تيليجرام باستخدام البيانات أدناه.",
    contacts: "طرق تقديم الشكوى",
    contactsBody: "اختر إحدى القنوات أدناه وأرسل تفاصيل شكواك.",
    phone: "رقم الهاتف",
    telegram: "تيليجرام",
    call: "اتصال",
    openTelegram: "فتح تيليجرام",
    empty: "لم تُضبط بعد بيانات التواصل للشكاوى. عد لاحقاً أو استخدم صفحة اتصل بنا.",
    contactUs: "اتصل بنا",
    unavailable: "تعذر تحميل بيانات الشكاوى. حاول لاحقاً.",
    skip: "انتقل إلى المحتوى"
  }
} satisfies Record<Locale, Record<string, string>>;

export function complaintsTelephoneHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("00")) return `tel:+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length >= 10) return `tel:+98${digits.slice(1)}`;
  return `tel:${digits}`;
}

export function complaintsTelegramHref(telegramId: string) {
  return `https://t.me/${encodeURIComponent(telegramId)}`;
}
