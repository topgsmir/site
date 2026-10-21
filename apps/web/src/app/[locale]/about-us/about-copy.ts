import type { Locale } from "@/lib/i18n";

export const aboutCopy = {
  fa: {
    title: "درباره ما",
    home: "صفحه اصلی",
    label: "معرفی مجموعه",
    heading: "درباره",
    brand: "تاپ جی‌اس‌ام",
    description: "تاپ جی‌اس‌ام مرجع تخصصی فایل، آموزش، ابزار و خدمات تعمیرات موبایل است؛ جایی برای انتخاب دقیق محصول و ارتباط مستقیم با کارشناسان.",
    mission: "ماموریت ما",
    missionBody: "کمک به تعمیرکاران و فروشگاه‌های موبایل برای دسترسی سریع به منابع تخصصی، آموزش کاربردی و خدمات قابل اعتماد.",
    offer: "چه ارائه می‌دهیم",
    offerItems: [
      ["فایل و آموزش", "منابع تخصصی برای تعمیرات و ارتقای مهارت فنی."],
      ["ابزار و تجهیزات", "ابزار و قطعات موردنیاز کارگاه تعمیرات موبایل."],
      ["خدمات آنلاین", "خدمات تخصصی با پیگیری شفاف سفارش و پشتیبانی."],
      ["کارشناسان", "ارتباط با کارشناسان فعال برای راهنمایی خرید و انتخاب درست."]
    ],
    contact: "تماس با ما",
    contactHint: "برای راهنمایی خرید، پشتیبانی یا همکاری با مجموعه در ارتباط باشید.",
    skip: "رفتن به محتوای اصلی"
  },
  en: {
    title: "About us",
    home: "Home",
    label: "About the company",
    heading: "About",
    brand: "Top GSM",
    description: "Top GSM is a specialist hub for mobile repair files, training, tools, and services—built for clear product choices and direct access to experts.",
    mission: "Our mission",
    missionBody: "Help technicians and mobile shops get specialist resources, practical training, and dependable services without friction.",
    offer: "What we offer",
    offerItems: [
      ["Files and training", "Specialist resources for repair work and technical skill growth."],
      ["Tools and equipment", "Workshop tools and gear for mobile repair businesses."],
      ["Online services", "Specialist services with clear order tracking and support."],
      ["Experts", "Connect with active experts for buying advice and the right fit."]
    ],
    contact: "Contact us",
    contactHint: "Reach out for buying help, support, or collaboration with our team.",
    skip: "Skip to content"
  },
  ar: {
    title: "من نحن",
    home: "الرئيسية",
    label: "تعريف بالمجموعة",
    heading: "عن",
    brand: "تاپ جي إس إم",
    description: "تاپ جي إس إم مرجع متخصص لملفات وتدريب وأدوات وخدمات صيانة الجوال؛ مكان لاختيار المنتج بدقة والتواصل مباشرة مع الخبراء.",
    mission: "مهمتنا",
    missionBody: "مساعدة فنيي الصيانة ومتاجر الجوال على الوصول السريع إلى مصادر متخصصة وتدريب عملي وخدمات موثوقة.",
    offer: "ماذا نقدّم",
    offerItems: [
      ["الملفات والتدريب", "مصادر متخصصة لأعمال الصيانة وتطوير المهارة الفنية."],
      ["الأدوات والمعدات", "أدوات ومعدات ورش صيانة الجوال."],
      ["الخدمات عن بُعد", "خدمات متخصصة مع متابعة واضحة للطلب ودعم مستمر."],
      ["الخبراء", "تواصل مع خبراء نشطين لإرشاد الشراء واختيار الأنسب."]
    ],
    contact: "اتصل بنا",
    contactHint: "تواصل معنا للاستفسار عن الشراء أو الدعم أو التعاون مع المجموعة.",
    skip: "انتقل إلى المحتوى"
  }
} satisfies Record<Locale, {
  title: string;
  home: string;
  label: string;
  heading: string;
  brand: string;
  description: string;
  mission: string;
  missionBody: string;
  offer: string;
  offerItems: readonly (readonly [string, string])[];
  contact: string;
  contactHint: string;
  skip: string;
}>;
