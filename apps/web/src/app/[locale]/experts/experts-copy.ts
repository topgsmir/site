import type { Locale } from "@/lib/i18n";

export const expertsCopy = {
  fa: {
    title: "کارشناسان",
    home: "صفحه اصلی",
    label: "فهرست متخصصان",
    heading: "کارشناسان",
    accent: "تاپ جی‌اس‌ام",
    description: "پروفایل کارشناسان فعال را ببینید، تخصص هر نفر را بررسی کنید و برای راهنمایی خرید یا هماهنگی خدمات وارد صفحه همان کارشناس شوید.",
    directoryTitle: "کارشناسان فعال",
    directoryBody: "هر پروفایل شامل تخصص و تعداد محصولات فعال است. برای جزئیات بیشتر، صفحه همان کارشناس را باز کنید.",
    viewProfile: "مشاهده پروفایل",
    expertFallback: "متخصص مجموعه",
    products: "محصول فعال",
    emptyExperts: "هنوز پروفایل کارشناسی در این فهرست منتشر نشده است.",
    expertsUnavailable: "فهرست کارشناسان بارگذاری نشد. کمی بعد دوباره تلاش کنید یا از صفحه تماس استفاده کنید.",
    contact: "تماس با پشتیبانی",
    remote: "خدمات ریموت",
    shop: "رفتن به فروشگاه",
    skip: "رفتن به محتوای اصلی",
    count: (total: string) => `${total} کارشناس`
  },
  en: {
    title: "Experts",
    home: "Home",
    label: "Specialist directory",
    heading: "Meet the",
    accent: "Top GSM experts",
    description: "Browse active specialist profiles, check each person's focus area, and open a profile to get buying help or coordinate a service.",
    directoryTitle: "Active experts",
    directoryBody: "Each profile shows specialty and active product count. Open a profile for more detail.",
    viewProfile: "View profile",
    expertFallback: "Team specialist",
    products: "active products",
    emptyExperts: "No expert profiles are published in this directory yet.",
    expertsUnavailable: "The expert directory could not be loaded. Try again later or use the contact page.",
    contact: "Contact support",
    remote: "Remote services",
    shop: "Visit the shop",
    skip: "Skip to content",
    count: (total: string) => `${total} experts`
  },
  ar: {
    title: "الخبراء",
    home: "الرئيسية",
    label: "دليل المختصين",
    heading: "خبراء",
    accent: "Top GSM",
    description: "اطلع على ملفات الخبراء النشطين، راجع تخصص كل منهم، وافتح الملف للحصول على مساعدة في الشراء أو تنسيق خدمة.",
    directoryTitle: "الخبراء النشطون",
    directoryBody: "يعرض كل ملف التخصص وعدد المنتجات النشطة. افتح الملف لمزيد من التفاصيل.",
    viewProfile: "عرض الملف",
    expertFallback: "متخصص في الفريق",
    products: "منتج نشط",
    emptyExperts: "لا توجد ملفات خبراء منشورة في هذا الدليل بعد.",
    expertsUnavailable: "تعذر تحميل قائمة الخبراء. حاول لاحقًا أو استخدم صفحة الاتصال.",
    contact: "تواصل مع الدعم",
    remote: "الخدمات عن بُعد",
    shop: "زيارة المتجر",
    skip: "انتقل إلى المحتوى",
    count: (total: string) => `${total} خبراء`
  }
} as const;

export type ExpertsCopy = (typeof expertsCopy)[Locale];
