import type { Locale } from "@/lib/i18n";

export const digitalProductCopy = {
  fa: {
    library: "فایل و آموزش", label: "محصول دانلودی", intro: "توضیحات و نسخه محصول را بررسی کنید و فایل موردنیازتان را انتخاب کنید.",
    preview: "پیش‌نمایش محصول", noPreview: "تصویری برای این محصول ثبت نشده", delivery: "دانلود فایل", deliveryBody: "فایل رایگان را پس از ورود دانلود کنید. فایل خریداری‌شده از همین صفحه و جزئیات سفارش در دسترس است.",
    purchase: "دریافت فایل", offerHelp: "نسخه، فروشنده و قیمت را بررسی کنید.", download: "دانلود", checking: "بررسی دسترسی…", downloadHint: "برای دریافت فایل، روی دانلود بزنید.", accessFailed: "دسترسی دانلود بررسی نشد. دوباره تلاش کنید.", limitReached: "تعداد مجاز دانلود به پایان رسیده است.", viewOrder: "مشاهده سفارش", chooseFile: "فایل موردنظر را انتخاب کنید", file: "فایل", description: "درباره این فایل", noDescription: "توضیحی برای این فایل ثبت نشده. پیش از خرید، سازگاری و محتوای فایل را از پشتیبانی بپرسید.",
    allowance: "تعداد دانلود هر فایل", unlimited: "بدون محدودیت تعداد دانلود", downloads: "بار", ready: "قابل خرید", freeReady: "آماده دانلود", free: "رایگان", review: "بررسی و خرید",
    details: "مشخصات فایل", guide: "تا دریافت فایل", guideIntro: "فایل رایگان را پس از ورود و فایل خریداری‌شده را پس از پرداخت دریافت کنید.",
    steps: [
      { title: "بررسی و انتخاب", body: "توضیحات، نسخه و سازگاری فایل با دستگاه یا ابزار خود را بررسی کنید." },
      { title: "دانلود یا خرید", body: "برای فایل رایگان دانلود را شروع کنید؛ برای فایل پولی، خرید را تکمیل کنید." },
      { title: "دریافت فایل", body: "بعد از خرید، از همین صفحه یا جزئیات سفارش فایل را دانلود کنید." }
    ],
    questions: "پیش از دانلود بدانید", accessQuestion: "لینک دانلود را کجا پیدا کنم؟", accessAnswer: "فایل رایگان را از همین صفحه دانلود کنید. فایل خریداری‌شده از این صفحه و جزئیات سفارش در دسترس است.",
    limitQuestion: "چند بار می‌توانم فایل را دانلود کنم؟", limitAnswer: "تعداد مجاز دانلود فایل خریداری‌شده به پیشنهاد فروشنده بستگی دارد. تعداد باقی‌مانده را در جزئیات سفارش می‌بینید.", freeLimitAnswer: "دریافت فایل رایگان به تعداد خرید محدود نیست؛ برای جلوگیری از سوءاستفاده ممکن است سرعت درخواست‌ها محدود شود.",
    compatibilityQuestion: "از سازگاری فایل چطور مطمئن شوم؟", compatibilityAnswer: "مدل دستگاه، نسخه نرم‌افزار و ابزار موردنیاز را با توضیحات محصول تطبیق دهید. اگر اطلاعات کافی نیست، پیش از خرید با پشتیبانی تماس بگیرید."
  },
  en: {
    library: "Files & training", label: "Downloadable product", intro: "Check the details and choose the right file for your next repair.",
    preview: "Product preview", noPreview: "No preview image provided", delivery: "Download your file", deliveryBody: "Sign in to download a free file. Purchased files are available here and in your order details.",
    purchase: "Get this download", offerHelp: "Check the version, seller and price.", download: "Download", checking: "Checking access…", downloadHint: "Select Download to get this file.", accessFailed: "We couldn't check download access. Try again.", limitReached: "The download limit has been reached.", viewOrder: "View order", chooseFile: "Choose a file", file: "File", description: "About this download", noDescription: "No description has been provided. Ask support about the file contents and compatibility before buying.",
    allowance: "Downloads per file", unlimited: "Unlimited downloads", downloads: "downloads", ready: "Available to buy", freeReady: "Ready to download", free: "Free", review: "Review & buy",
    details: "Download details", guide: "Get your file", guideIntro: "Sign in for free files or complete payment for paid files.",
    steps: [
      { title: "Check your file", body: "Review the description, version and compatibility with your device or tools." },
      { title: "Download or buy", body: "Start a free download, or complete checkout for a paid file." },
      { title: "Get your file", body: "After purchase, download here or from your order details." }
    ],
    questions: "Before you download", accessQuestion: "Where will I find my downloads?", accessAnswer: "Download free files here. Purchased files are available here and in your order details.",
    limitQuestion: "How many times can I download a file?", limitAnswer: "Each paid offer has a per-file allowance. You can see remaining downloads in your order details.", freeLimitAnswer: "Free files are not limited by purchase count, but requests may be rate limited to prevent abuse.",
    compatibilityQuestion: "How do I check compatibility?", compatibilityAnswer: "Match your device model, software version and required tools to the product description. If anything is unclear, contact support before purchasing."
  },
  ar: {
    library: "ملفات وتدريب", label: "منتج قابل للتنزيل", intro: "راجع التفاصيل والإصدار واختر الملف المناسب لعملك في الصيانة.",
    preview: "معاينة المنتج", noPreview: "لم تُضف صورة لهذا المنتج", delivery: "تنزيل الملف", deliveryBody: "سجّل الدخول لتنزيل الملف المجاني. الملفات المشتراة متاحة هنا وفي تفاصيل الطلب.",
    purchase: "تنزيل الملف", offerHelp: "راجع الإصدار والبائع والسعر.", download: "تنزيل", checking: "جارٍ التحقق من الوصول…", downloadHint: "اضغط تنزيل للحصول على الملف.", accessFailed: "تعذّر التحقق من الوصول إلى الملف. حاول مرة أخرى.", limitReached: "بلغت الحد المسموح للتنزيل.", viewOrder: "عرض الطلب", chooseFile: "اختر الملف", file: "ملف", description: "عن هذا الملف", noDescription: "لم يُضف وصف لهذا الملف. اسأل الدعم عن محتوياته وتوافقه قبل الشراء.",
    allowance: "عدد التنزيلات لكل ملف", unlimited: "تنزيلات غير محدودة", downloads: "مرات تنزيل", ready: "متاح للشراء", freeReady: "جاهز للتنزيل", free: "مجاني", review: "مراجعة وشراء",
    details: "تفاصيل الملف", guide: "احصل على ملفك", guideIntro: "سجّل الدخول للملفات المجانية أو أكمل الدفع للملفات المدفوعة.",
    steps: [
      { title: "راجع الملف", body: "تحقق من الوصف والإصدار والتوافق مع جهازك أو أدواتك." },
      { title: "نزّل أو اشترِ", body: "ابدأ تنزيل الملف المجاني، أو أكمل شراء الملف المدفوع." },
      { title: "احصل على ملفك", body: "بعد الشراء، نزّل الملف من هنا أو من تفاصيل الطلب." }
    ],
    questions: "قبل التنزيل", accessQuestion: "أين أجد روابط التنزيل؟", accessAnswer: "نزّل الملفات المجانية من هنا. الملفات المشتراة متاحة هنا وفي تفاصيل الطلب.",
    limitQuestion: "كم مرة يمكنني تنزيل الملف؟", limitAnswer: "لكل عرض مدفوع عدد مسموح من التنزيلات لكل ملف. ستجد العدد المتبقي في تفاصيل الطلب.", freeLimitAnswer: "الملفات المجانية غير محدودة بعدد عمليات الشراء، لكن قد يُحدّد معدل الطلبات لمنع إساءة الاستخدام.",
    compatibilityQuestion: "كيف أتحقق من التوافق؟", compatibilityAnswer: "طابق موديل جهازك وإصدار البرنامج والأدوات المطلوبة مع وصف المنتج. إذا كانت المعلومات غير كافية، تواصل مع الدعم قبل الشراء."
  }
} satisfies Record<Locale, unknown>;

export function downloadAllowance(maxDownloads: number, locale: Locale) {
  const c = digitalProductCopy[locale];
  return maxDownloads === 0 ? c.unlimited : `${new Intl.NumberFormat(locale).format(maxDownloads)} ${c.downloads}`;
}
