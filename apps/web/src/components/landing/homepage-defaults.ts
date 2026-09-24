import type { HomepageContent, HomepageLocale } from "@topgsm/shared-types";

/** Initial editorial content. Once saved, the administrator's document takes precedence. */
export function defaultHomepage(locale: HomepageLocale): HomepageContent {
  const fa = locale === "fa";
  const ar = locale === "ar";
  const t = (persian: string, english: string, arabic: string) => fa ? persian : ar ? arabic : english;
  const shop = `/${locale}/products`;
  const search = (term: string) => `${shop}?search=${encodeURIComponent(term)}`;
  return {
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
      { title: t("خدمات آنلاین", "Online services", "الخدمات عن بعد"), description: t("کمک تخصصی، از راه دور", "Specialist help, remotely", "مساعدة متخصصة عن بعد"), label: "", href: `${shop}?type=service`, image: "" },
      { title: t("آموزشگاه تعمیرات", "Repair academy", "أكاديمية الصيانة"), description: t("یادگیری برای تعمیر بعدی", "Learn for your next repair", "تعلّم للصيانة القادمة"), label: "", href: search(t("آموزش", "training", "تدريب")), image: "" },
      { title: t("لایسنس و اکتیو باکس", "Licenses & activation", "التراخيص والتفعيل"), description: t("ابزار کارتان را آماده کنید", "Get your tools ready", "جهّز أدوات عملك"), label: "", href: search(t("لایسنس", "license", "ترخيص")), image: "" }
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
      description: t("ابزار و آموزش‌های منتخب برای میز کار شما", "Selected tools and training for your workbench", "أدوات وتدريبات مختارة لطاولة عملك"),
      items: [
        { title: "Oxygen Forensic Detective", description: t("آشنایی با ابزار و آموزش کار با آن", "Explore the tool and its training", "تعرف على الأداة وتدريبها"), label: "OXYGEN", href: search("Oxygen"), image: "" },
        { title: "UFED", description: t("آموزش و ابزارهای تخصصی موبایل", "Specialist mobile tools and training", "أدوات وتدريب متخصص للجوال"), label: "UFED", href: search("UFED"), image: "" },
        { title: "MD-Next", description: t("با امکانات این ابزار آشنا شوید", "Discover what this tool can do", "اكتشف إمكانات هذه الأداة"), label: "MD-NEXT", href: search("MD-Next"), image: "" },
        { title: t("آموزش خدمات ریموت", "Remote service training", "تدريب الخدمات عن بعد"), description: t("از شروع کار تا انجام خدمات", "From getting started to delivering a service", "من البداية إلى تقديم الخدمة"), label: "ACADEMY", href: search(t("ریموت", "remote", "عن بعد")), image: "" }
      ]
    },
    experts: { enabled: true, title: t("ستاره‌های ایران", "The people behind the repair", "خبراء تثق بهم"), description: t("تخصص‌های متفاوت، یک هدف مشترک: حل مشکل شما.", "Different specialties. One shared purpose: your next repair.", "تخصصات مختلفة، وهدف واحد: حل مشكلتك.") },
    latest: { enabled: true, title: t("تازه‌های تاپ جی‌اس‌ام", "Fresh on the workbench", "أحدث إضافات Top GSM"), description: t("آخرین فایل‌ها، آموزش‌ها و سرویس‌های منتشرشده", "The latest files, training, and services", "أحدث الملفات والتدريبات والخدمات") },
    about: {
      enabled: true, title: t("چرا تاپ جی‌اس‌ام؟", "On your side of the workbench.", "لماذا Top GSM؟"),
      description: t("تعمیر، فقط ابزار نمی‌خواهد. دانش، تجربه و یک همراه متخصص هم لازم دارد. اینجا همه را کنار هم پیدا می‌کنید.", "Good repair takes more than tools. It takes knowledge, experience, and someone to turn to. Find them together here.", "الصيانة تحتاج إلى أكثر من الأدوات. تحتاج إلى معرفة وخبرة ومتخصص تلجأ إليه. هنا تجدها معًا."),
      points: [t("فایل و آموزش، متناسب با مدل و مشکل دستگاه", "Files and training for a specific device and issue", "ملفات وتدريب حسب الموديل والمشكلة"), t("ارتباط مستقیم با کارشناسان هر حوزه", "A direct path to a specialist in each field", "تواصل مباشر مع متخصصي كل مجال"), t("دسترسی به سفارش‌ها و دانلودها از حساب کاربری", "Your orders and downloads, together in your account", "طلباتك وتنزيلاتك في حساب واحد"), t("همراهی برای گسترش دانش تعمیرات موبایل", "A place to grow your repair knowledge", "مكان لتطوير معرفتك في صيانة الجوال")],
      link: { label: t("بیشتر آشنا شویم", "Let’s talk", "لنتواصل"), href: `/${locale}/contact-us` }
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
