import type { HomepageContent, HomepageLocale } from "@topgsm/shared-types";

export function homepageExpertsTitle(title: string, locale: HomepageLocale) {
  return locale === "fa" && title === "ستاره‌های ایران" ? "متخصصین مجموعه" : title;
}

export function homepageHeroAds(locale: HomepageLocale): NonNullable<HomepageContent["heroAds"]> {
  const fa = locale === "fa";
  const ar = locale === "ar";
  const t = (persian: string, english: string, arabic: string) => fa ? persian : ar ? arabic : english;
  return [
    { title: t("آنلاک مودم", "Modem unlock", "فتح قفل المودم"), description: t("گزینه‌های سرویس را بر اساس مدل مودم بررسی کنید.", "Review service options for your modem model.", "راجع خيارات الخدمة بحسب طراز المودم."), label: t("سرویس منتخب", "FEATURED SERVICE", "خدمة مميزة"), href: `/${locale}/services/modem-unlock`, image: "/images/home/ad-modem-unlock.webp" },
    { title: t("آنلاک شبکه سامسونگ", "Samsung network unlock", "فتح شبكة سامسونج"), description: t("گزینه‌های آنلاک شبکه را بررسی کنید.", "Explore network unlock options.", "استعرض خيارات فتح الشبكة."), label: t("سرویس موبایل", "PHONE SERVICE", "خدمة الهاتف"), href: `/${locale}/services/samsung-network-unlock`, image: "/images/home/ad-samsung-network.webp" },
    { title: t("حذف FRP", "FRP removal", "إزالة FRP"), description: t("سرویس متناسب با مدل گوشی را بررسی کنید.", "Review options for your phone model.", "راجع الخيارات المناسبة لطراز هاتفك."), label: t("سرویس تخصصی", "SPECIALIST SERVICE", "خدمة متخصصة"), href: `/${locale}/services/frp-removal`, image: "/images/home/ad-frp.webp" }
  ];
}

/** Initial editorial content. Once saved, the administrator's document takes precedence. */
export function defaultHomepage(locale: HomepageLocale): HomepageContent {
  const fa = locale === "fa";
  const ar = locale === "ar";
  const t = (persian: string, english: string, arabic: string) => fa ? persian : ar ? arabic : english;
  const shop = `/${locale}/products`;
  const search = (term: string) => `${shop}?search=${encodeURIComponent(term)}`;
  const product = (slug: string) => `${shop}/${encodeURIComponent(slug)}`;
  return {
    heroAds: homepageHeroAds(locale),
    hero: {
      eyebrow: t("همراهِ هر روزِ تعمیرکاران موبایل", "YOUR EVERYDAY REPAIR COMPANION", "رفيقك اليومي في صيانة الجوال"),
      title: t("تعمیر حرفه‌ای،", "The craft of repair.", "صيانة احترافية،"),
      accent: t("از اینجا شروع می‌شود.", "Starts here.", "تبدأ من هنا."),
      description: t("فایل، آموزش و ابزار تخصصی را پیدا کنید؛ برای قدم بعدی، از کارشناس همان حوزه کمک بگیرید.", "Find the files, knowledge, and tools for your next repair. Get help from a specialist who knows your device.", "اعثر على الملفات والتدريب والأدوات المناسبة. واستعن بمتخصص يعرف جهازك للخطوة التالية."),
      image: "/images/repair-studio.png",
      imageAlt: t("نمای نزدیک قطعات گوشی و ابزار دقیق تعمیر", "Disassembled smartphone and precision repair tools", "مكونات هاتف مفككة وأدوات صيانة دقيقة"),
      primary: { label: t("کشف محصولات", "Explore products", "اكتشف المنتجات"), href: shop },
      secondary: { label: t("ارتباط با کارشناس", "Find an expert", "تواصل مع خبير"), href: "#agents" }
    },
    shortcuts: [
      { title: t("خدمات آنلاین", "Online services", "الخدمات عن بعد"), description: t("کمک تخصصی از راه دور", "Specialist help, remotely", "مساعدة متخصصة عن بعد"), label: "", href: `${shop}?type=service`, image: "/images/home/shortcuts/remote-service.webp" },
      { title: t("آموزشگاه تعمیرات", "Repair academy", "أكاديمية الصيانة"), description: t("آموزش برای تعمیر بعدی", "Learn for your next repair", "تعلّم للصيانة القادمة"), label: "", href: search(t("آموزش", "training", "تدريب")), image: "/images/home/shortcuts/repair-academy.webp" },
      { title: t("لایسنس و اکتیو باکس", "Licenses & activation", "التراخيص والتفعيل"), description: t("فعال‌سازی ابزار تخصصی", "Activate specialist tools", "تفعيل الأدوات المتخصصة"), label: "", href: search(t("لایسنس", "license", "ترخيص")), image: "/images/home/shortcuts/licenses.webp" },
      { title: t("فایل فلش و رام", "Firmware files", "ملفات الفلاش والروم"), description: t("فایل مناسب هر مدل", "Files for the right model", "الملف المناسب لكل موديل"), label: "", href: search(t("فایل فلش", "firmware", "فلاش")), image: "/images/home/shortcuts/firmware.webp" },
      { title: t("تعمیر برد", "Board repair", "إصلاح اللوحة"), description: t("از عیب‌یابی تا ترمیم", "Diagnose and repair", "من التشخيص إلى الإصلاح"), label: "", href: search(t("تعمیر برد", "board repair", "إصلاح اللوحة")), image: "/images/home/shortcuts/board-repair.webp" },
      { title: t("ابزار تعمیرات", "Repair tools", "أدوات الصيانة"), description: t("تجهیزات میز کار شما", "Equip your workbench", "جهّز طاولة عملك"), label: "", href: `${shop}?type=physical`, image: "/images/home/shortcuts/repair-tools.webp" }
    ],
    collections: {
      enabled: true,
      title: t("برای هر تعمیر، یک راه‌حل.", "A solution for every repair.", "لكل صيانة، حلّ."),
      description: t("از مدل گوشی شروع کنید، به فایل و سرویس درست برسید.", "Start with your device. Find the right file or service.", "ابدأ بموديل جهازك، واعثر على الملف أو الخدمة المناسبة."),
      items: [
        { title: t("فایل فلش و رام رسمی", "Flash files & firmware", "ملفات الفلاش والروم"), description: t("فایل مناسب مدل شما، بدون جست‌وجوی طولانی", "The right firmware for your device", "الملف المناسب لموديل جهازك"), label: "FIRMWARE", href: search(t("فایل فلش", "firmware", "فلاش")), image: "/images/home/firmware.webp" },
        { title: t("فایل دامپ و ترمیم بوت", "Dumps & boot repair", "ملفات الدامب وإصلاح الإقلاع"), description: t("برای وقتی که گوشی روشن نمی‌شود", "Bring the next device back to life", "عندما لا يعمل الجهاز"), label: "HARDWARE", href: search(t("دامپ", "dump", "دامب")), image: "/images/home/hardware.webp" },
        { title: t("آنلاک و خدمات شبکه", "Unlock & network services", "فتح القفل وخدمات الشبكة"), description: t("سرویس‌های تخصصی گوشی و مودم", "Specialist phone and modem services", "خدمات متخصصة للهواتف والمودم"), label: "REMOTE SERVICES", href: search(t("آنلاک", "unlock", "فتح")), image: "/images/home/remote.webp" }
      ]
    },
    offers: {
      enabled: true,
      title: t("پیشنهادات داغ", "In the spotlight", "اقتراحات مميزة"),
      description: t("ابزار، آموزش و خدمات منتخب برای میز کار شما", "Selected tools, training, and services for your workbench", "أدوات وتدريبات وخدمات مختارة لطاولة عملك"),
      items: [
        { title: "Oxygen Forensic Detective", description: t("آشنایی با ابزار و آموزش کار با آن", "Explore the tool and its training", "تعرف على الأداة وتدريبها"), label: "OXYGEN", href: search("Oxygen"), image: "/images/home/offers/oxygen-forensic-detective.webp" },
        { title: "UFED", description: t("آموزش و ابزارهای تخصصی موبایل", "Specialist mobile tools and training", "أدوات وتدريب متخصص للجوال"), label: "UFED", href: search("UFED"), image: "/images/home/offers/ufed.webp" },
        { title: "MD-Next", description: t("با امکانات این ابزار آشنا شوید", "Discover what this tool can do", "اكتشف إمكانات هذه الأداة"), label: "MD-NEXT", href: search("MD-Next"), image: "/images/home/offers/md-next.webp" },
        { title: t("آموزش خدمات ریموت", "Remote service training", "تدريب الخدمات عن بعد"), description: t("از شروع کار تا انجام خدمات", "From getting started to delivering a service", "من البداية إلى تقديم الخدمة"), label: "ACADEMY", href: search(t("ریموت", "remote", "عن بعد")), image: "/images/home/offers/remote-service-training.webp" },
        { title: t("حذف قفل گوشی", "Phone unlock service", "خدمة فتح قفل الهاتف"), description: t("خدمات تخصصی برای مشکل قفل گوشی", "Specialist help with a locked phone", "مساعدة متخصصة لمشكلة قفل الهاتف"), label: "UNLOCK", href: product("حذف-قفل-گوشی"), image: "/images/home/offers/phone-unlock.webp" },
        { title: t("رفع مشکل نرم‌افزاری از راه دور", "Remote software support", "الدعم البرمجي عن بعد"), description: t("راه‌اندازی و رفع مشکل با کمک کارشناس", "Setup and troubleshooting with a specialist", "الإعداد وحل المشكلات بمساعدة متخصص"), label: "REMOTE", href: product("remote-phone-software-setup-20260923100402"), image: "/images/home/offers/remote-software-setup.webp" },
        { title: t("کابل USB-C با روکش بافته", "Braided USB-C cable", "كابل USB-C مضفّر"), description: t("اتصال USB-C به USB-C برای میز کار", "USB-C to USB-C for your workbench", "توصيل USB-C إلى USB-C لطاولة العمل"), label: "USB-C", href: product("braided-usbc-cable"), image: "/images/home/offers/braided-usbc-cable.webp" }
      ]
    },
    experts: { enabled: true, title: t("متخصصین مجموعه", "The people behind the repair", "خبراء تثق بهم"), description: t("تخصص‌های متفاوت، یک هدف مشترک: حل مشکل شما.", "Different specialties. One shared purpose: your next repair.", "تخصصات مختلفة، وهدف واحد: حل مشكلتك.") },
    latest: { enabled: true, title: t("تازه‌های تاپ جی‌اس‌ام", "Fresh on the workbench", "أحدث إضافات Top GSM"), description: t("آخرین فایل‌ها، آموزش‌ها و سرویس‌های منتشرشده", "The latest files, training, and services", "أحدث الملفات والتدريبات والخدمات") },
    about: {
      enabled: true, title: t("همکاری فنی برای مجموعه شما", "Technical collaboration for your team", "تعاون تقني يناسب فريقك"),
      description: t("نیاز تیم شما را بررسی می‌کنیم و برای دسترسی به فایل، آموزش و خدمات تخصصی، مسیر همکاری روشنی پیشنهاد می‌دهیم.", "Tell us what your team needs. We can discuss files, practical training, and specialist services, then agree on a clear way to work together.", "نستمع إلى احتياجات فريقك ونقترح طريقة واضحة للتعاون في الملفات والتدريب والخدمات المتخصصة."),
      points: [t("فایل و منابع فنی", "Technical files and resources", "ملفات وموارد تقنية"), t("آموزش کاربردی", "Practical training", "تدريب عملي"), t("ارتباط با کارشناس", "Access to specialists", "التواصل مع المختصين")],
      link: { label: t("درخواست همکاری", "Discuss collaboration", "اطلب التعاون"), href: `/${locale}/contact-us` }
    },
    footer: {
      description: t("فایل، آموزش و خدمات تخصصی؛ کنار تعمیرکاران موبایل، از اولین سؤال تا آخرین مرحله تعمیر.", "Files, training, and specialist services. By your side, from the first question to the final repair.", "ملفات وتدريب وخدمات متخصصة. بجانبك من السؤال الأول إلى الخطوة الأخيرة."),
      links: [
        { label: t("فروشگاه", "Shop", "المتجر"), href: shop },
        { label: t("مجله تعمیرات", "Repair journal", "مجلة الصيانة"), href: `/${locale}/blog` },
        { label: t("کارشناسان", "Experts", "الخبراء"), href: "#agents" },
        { label: t("تماس با ما", "Contact", "اتصل بنا"), href: `/${locale}/contact-us` },
        { label: t("حساب کاربری", "My account", "حسابي"), href: `/${locale}/login` }
      ]
    }
  };
}
