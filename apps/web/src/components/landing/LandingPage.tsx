import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { DesignIcon, type DesignIconName } from "@/components/DesignIcon";
import styles from "./LandingPage.module.css";
import { getDirection, localizePath, type Locale } from "@/lib/i18n";
import { LandingMotion } from "./LandingMotion";
import { PublicHeader } from "@/components/PublicHeader";

export type HomepageProduct = {
  id: string;
  title: string;
  slug?: string;
  type: "digital" | "physical" | "service";
  price?: number;
  currency?: string;
  category?: string;
  createdAt?: string;
};

export type HomepageAgent = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  phone?: string;
  available?: boolean;
};

type LandingPageProps = {
  locale: Locale;
  products: HomepageProduct[];
  agents: HomepageAgent[];
  accountHref: string | null;
};

type LandingCopy = {
  brandDescription: string;
  searchLabel: string;
  searchPlaceholder: string;
  loginText: string;
  myAccountText: string;
  cartText: string;
  menuText: string;
  navItems: Array<{ label: string; href: string }>;
  heroKicker: string;
  heroTitleLead: string;
  heroTitleAccent: string;
  heroBody: string;
  primaryAction: string;
  secondaryAction: string;
  liveDesk: string;
  responseLabel: string;
  responseValue: string;
  completedLabel: string;
  completedValue: string;
  servicesTitle: string;
  servicesBody: string;
  serviceCards: Array<{ title: string; body: string; detail: string; href: string }>;
  expertsTitle: string;
  expertsBody: string;
  availableText: string;
  unavailableText: string;
  callText: string;
  emptyExperts: string;
  productsTitle: string;
  productsBody: string;
  viewAll: string;
  emptyProducts: string;
  whyTitle: string;
  whyWords: string[];
  trust: Array<{ value: string; description: string }>;
  ctaTitle: string;
  ctaBody: string;
  ctaAction: string;
  quickAccess: string;
  services: string;
  account: string;
  sellerDashboard: string;
  footerDescription: string;
};

const copyByLocale: Record<Locale, LandingCopy> = {
  fa: {
    brandDescription: "مرجع تخصصی تعمیرکاران موبایل",
    searchLabel: "جست‌وجو",
    searchPlaceholder: "مدل گوشی، فایل، آموزش یا سرویس را بنویسید",
    loginText: "ورود و ثبت‌نام",
    myAccountText: "حساب من",
    cartText: "سبد خرید",
    menuText: "منو",
    navItems: [
      { label: "خدمات آنلاین", href: "#services" },
      { label: "آموزش تعمیرات", href: "#products" },
      { label: "لایسنس و اکتیو باکس", href: "#services" },
      { label: "کارشناسان", href: "#agents" }
    ],
    heroKicker: "برای تعمیرکاران موبایل ایران",
    heroTitleLead: "هر چیزی که برای تعمیر موبایل لازم دارید؛",
    heroTitleAccent: "یک‌جا و مطمئن.",
    heroBody: "فایل تست‌شده، آموزش کاربردی، لایسنس ابزار و پشتیبانی آنلاین را سریع پیدا کنید و مستقیم از متخصص همان حوزه کمک بگیرید.",
    primaryAction: "جست‌وجوی محصولات",
    secondaryAction: "درخواست پشتیبانی",
    liveDesk: "میز پشتیبانی آنلاین",
    responseLabel: "مسیر پشتیبانی",
    responseValue: "بر اساس نوع درخواست",
    completedLabel: "حوزه خدمات",
    completedValue: "فایل، آموزش و سرویس",
    servicesTitle: "مسیر کوتاه‌تر تا حل مشکل",
    servicesBody: "سرویس موردنیازتان را انتخاب کنید؛ ادامه کار را متخصص همان بخش پیگیری می‌کند.",
    serviceCards: [
      { title: "حل مشکل از راه دور", body: "برای آنلاک، FRP، ترمیم سریال و خطاهای نرم‌افزاری درخواست ثبت کنید.", detail: "ثبت درخواست و پیگیری لحظه‌ای", href: "#support" },
      { title: "فایل و آموزش تعمیرات", body: "دامپ، شماتیک، مسیرهای برد و آموزش‌های تست‌شده را با جست‌وجوی مدل پیدا کنید.", detail: "دانلود سریع بعد از خرید", href: "#products" },
      { title: "لایسنس و ابزار تخصصی", body: "فعال‌سازی و تمدید ابزارهایی مثل Oxygen، UFED و MD-Next با پشتیبانی راه‌اندازی.", detail: "تحویل و راه‌اندازی توسط کارشناس", href: "#products" }
    ],
    expertsTitle: "مستقیم با کارشناس همان برند صحبت کنید",
    expertsBody: "پروفایل‌ها از سامانه خوانده می‌شوند؛ وضعیت حضور، امتیاز و تخصص همیشه به‌روز است.",
    availableText: "آنلاین",
    unavailableText: "در حال پاسخ‌گویی",
    callText: "تماس با کارشناس",
    emptyExperts: "هنوز کارشناسی برای نمایش منتشر نشده است.",
    productsTitle: "تازه‌ترین فایل‌ها و آموزش‌ها",
    productsBody: "محصولات این بخش مستقیم از فروشگاه بارگذاری می‌شوند و همیشه تازه‌اند.",
    viewAll: "مشاهده همه محصولات",
    emptyProducts: "هنوز محصولی منتشر نشده است.",
    whyTitle: "برای تعمیرکار ساخته شده، نه برای پیچیده‌تر کردن کار.",
    whyWords: ["فایل‌های", "کنترل‌شده،", "پاسخ‌گویی", "تخصصی", "و", "پیگیری", "شفاف؛", "تا", "وقت", "شما", "صرف", "تعمیر", "شود،", "نه", "جست‌وجو."],
    trust: [
      { value: "فایل", description: "محتوای تخصصی برای مدل و مسئله مشخص" },
      { value: "خدمت", description: "مسیر روشن برای ثبت و پیگیری درخواست" },
      { value: "حساب", description: "دسترسی به سفارش‌ها و فایل‌های خریداری‌شده" },
      { value: "فروشنده", description: "مدیریت محصول و محتوای تخصصی" }
    ],
    ctaTitle: "مشکل دستگاه را بنویسید؛ مسیر حل را پیدا می‌کنیم.",
    ctaBody: "اگر نمی‌دانید کدام فایل یا سرویس مناسب است، قبل از خرید از کارشناس بپرسید.",
    ctaAction: "شروع گفت‌وگو",
    quickAccess: "دسترسی سریع",
    services: "خدمات اصلی",
    account: "حساب کاربری",
    sellerDashboard: "پنل فروشنده",
    footerDescription: "فروشگاه فایل، آموزش و خدمات آنلاین تخصصی برای تعمیرکاران موبایل ایران."
  },
  en: {
    brandDescription: "Mobile repair specialists",
    searchLabel: "Search",
    searchPlaceholder: "Search a model, file, tutorial, or service",
    loginText: "Sign in",
    myAccountText: "My account",
    cartText: "Cart",
    menuText: "Menu",
    navItems: [
      { label: "Online services", href: "#services" },
      { label: "Repair training", href: "#products" },
      { label: "Licenses", href: "#services" },
      { label: "Specialists", href: "#agents" }
    ],
    heroKicker: "Built for mobile repair professionals",
    heroTitleLead: "Everything mobile repair needs,",
    heroTitleAccent: "in one trusted place.",
    heroBody: "Find verified files, practical training, tool licenses, and direct support from the right specialist.",
    primaryAction: "Search products",
    secondaryAction: "Get support",
    liveDesk: "Live support desk",
    responseLabel: "Support route",
    responseValue: "Matched to the request",
    completedLabel: "Coverage",
    completedValue: "Files, training, services",
    servicesTitle: "A shorter route to the fix",
    servicesBody: "Choose the service you need and a specialist in that field will take it from there.",
    serviceCards: [
      { title: "Remote solutions", body: "Submit unlock, FRP, serial repair, and software issues.", detail: "Live progress tracking", href: "#support" },
      { title: "Repair files and training", body: "Find dumps, schematics, board paths, and tested tutorials by model.", detail: "Download after purchase", href: "#products" },
      { title: "Licenses and pro tools", body: "Activate and renew Oxygen, UFED, MD-Next, and other tools.", detail: "Specialist setup support", href: "#products" }
    ],
    expertsTitle: "Talk directly to a specialist for your brand",
    expertsBody: "Profiles are loaded from the platform, so availability, ratings, and expertise stay current.",
    availableText: "Online",
    unavailableText: "Currently assisting",
    callText: "Call specialist",
    emptyExperts: "No specialist profiles have been published yet.",
    productsTitle: "Latest files and training",
    productsBody: "This collection is loaded directly from the marketplace and stays current.",
    viewAll: "View all products",
    emptyProducts: "No products have been published yet.",
    whyTitle: "Built for repair professionals, not to add more friction.",
    whyWords: ["Verified", "files,", "specialist", "answers,", "and", "clear", "tracking", "keep", "your", "time", "focused", "on", "the", "repair."],
    trust: [
      { value: "Files", description: "specialist content for a specific model and issue" },
      { value: "Service", description: "a clear route to submit and track a request" },
      { value: "Account", description: "access to orders and purchased downloads" },
      { value: "Seller", description: "tools for products and specialist publishing" }
    ],
    ctaTitle: "Describe the device issue. We will find the right route.",
    ctaBody: "If you are unsure which file or service fits, ask a specialist before buying.",
    ctaAction: "Start a conversation",
    quickAccess: "Quick access",
    services: "Main services",
    account: "Account",
    sellerDashboard: "Seller dashboard",
    footerDescription: "Specialist files, training, and online services for mobile repair professionals."
  },
  ar: {
    brandDescription: "مرجع متخصصي صيانة الجوال",
    searchLabel: "بحث",
    searchPlaceholder: "ابحث عن موديل أو ملف أو تدريب أو خدمة",
    loginText: "تسجيل الدخول",
    myAccountText: "حسابي",
    cartText: "السلة",
    menuText: "القائمة",
    navItems: [
      { label: "الخدمات عبر الإنترنت", href: "#services" },
      { label: "تدريب الصيانة", href: "#products" },
      { label: "التراخيص", href: "#services" },
      { label: "المتخصصون", href: "#agents" }
    ],
    heroKicker: "مصمم لمتخصصي صيانة الجوال",
    heroTitleLead: "كل ما تحتاجه لصيانة الجوال،",
    heroTitleAccent: "في مكان واحد موثوق.",
    heroBody: "اعثر على ملفات موثوقة وتدريب عملي وتراخيص أدوات ودعم مباشر من المتخصص المناسب.",
    primaryAction: "ابحث في المنتجات",
    secondaryAction: "اطلب الدعم",
    liveDesk: "مكتب الدعم المباشر",
    responseLabel: "مسار الدعم",
    responseValue: "حسب نوع الطلب",
    completedLabel: "مجال الخدمات",
    completedValue: "ملفات وتدريب وخدمات",
    servicesTitle: "طريق أقصر إلى الحل",
    servicesBody: "اختر الخدمة التي تحتاجها وسيتابعها متخصص القسم.",
    serviceCards: [
      { title: "حل عن بعد", body: "سجل طلبات فتح القفل وFRP وإصلاح السيريال وأخطاء النظام.", detail: "متابعة مباشرة للطلب", href: "#support" },
      { title: "ملفات وتدريب الصيانة", body: "اعثر على الدامب والمخططات ومسارات اللوحة والدروس حسب الموديل.", detail: "تحميل سريع بعد الشراء", href: "#products" },
      { title: "التراخيص والأدوات", body: "فعّل وجدّد Oxygen وUFED وMD-Next وغيرها.", detail: "دعم إعداد من متخصص", href: "#products" }
    ],
    expertsTitle: "تحدث مباشرة مع متخصص العلامة",
    expertsBody: "تُحمّل الملفات الشخصية من المنصة لتبقى الحالة والتقييمات محدثة.",
    availableText: "متصل",
    unavailableText: "يجيب على طلب آخر",
    callText: "اتصل بالمتخصص",
    emptyExperts: "لم يُنشر أي ملف لمتخصص بعد.",
    productsTitle: "أحدث الملفات والدروس",
    productsBody: "تُحمّل هذه المجموعة مباشرة من المتجر وتبقى محدثة.",
    viewAll: "عرض كل المنتجات",
    emptyProducts: "لم يُنشر أي منتج بعد.",
    whyTitle: "مصمم للمتخصص، لا لتعقيد عمله.",
    whyWords: ["ملفات", "موثوقة،", "إجابات", "متخصصة", "ومتابعة", "واضحة", "لتبقى", "مركزاً", "على", "الصيانة."],
    trust: [
      { value: "ملفات", description: "محتوى متخصص لموديل ومشكلة محددين" },
      { value: "خدمة", description: "مسار واضح لتسجيل الطلب ومتابعته" },
      { value: "حساب", description: "الوصول إلى الطلبات والملفات المشتراة" },
      { value: "بائع", description: "أدوات لإدارة المنتجات والمحتوى المتخصص" }
    ],
    ctaTitle: "اكتب مشكلة الجهاز وسنجد مسار الحل.",
    ctaBody: "إذا لم تعرف الملف أو الخدمة المناسبة، اسأل المتخصص قبل الشراء.",
    ctaAction: "ابدأ المحادثة",
    quickAccess: "وصول سريع",
    services: "الخدمات الرئيسية",
    account: "الحساب",
    sellerDashboard: "لوحة البائع",
    footerDescription: "ملفات وتدريب وخدمات متخصصة لمحترفي صيانة الجوال."
  }
};

const trustedTools = ["OXYGEN", "UFED", "MD-NEXT", "SAMSUNG", "XIAOMI", "APPLE", "MEDIATEK"];

function productTypeLabel(type: HomepageProduct["type"], locale: Locale) {
  const labels = {
    fa: { digital: "فایل دیجیتال", physical: "کالای فیزیکی", service: "خدمات آنلاین" },
    en: { digital: "Digital file", physical: "Physical product", service: "Online service" },
    ar: { digital: "ملف رقمي", physical: "منتج فعلي", service: "خدمة عبر الإنترنت" }
  } as const;
  return labels[locale][type];
}

function formatPrice(product: HomepageProduct, locale: Locale) {
  if (product.price === undefined) return locale === "fa" ? "مشاهده جزئیات" : locale === "ar" ? "عرض التفاصيل" : "View details";
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { maximumFractionDigits: 2 }).format(product.price) + (product.currency ? ` ${product.currency}` : "");
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("");
}

function localizedHref(locale: Locale, href: string) {
  return localizePath(locale, href) as Route;
}

const introductions = {
  fa: { title: "تعمیر حرفه‌ای،", accent: "با همراهی درست.", kicker: "ابزار درست. خیال راحت.", body: "از فایل و آموزش تا ابزار تخصصی؛ هر چیزی که برای قدم بعدی تعمیر نیاز دارید، اینجاست.", browse: "کشف محصولات", note: "برای تعمیرکارانی که به کیفیت اهمیت می‌دهند", image: "گوشی نقره‌ای با قطعات بازشده و ابزار دقیق تعمیر", caption: "دانش و ابزار، کنار هم.", tools: "در کنار ابزارهایی که می‌شناسید", services: "برای هر مسئله، یک راه روشن.", experts: "تجربه‌ای که کنار شماست.", expertsBody: "با متخصص برند دستگاهتان آشنا شوید. گاهی یک گفت‌وگو، مسیر تعمیر را روشن می‌کند.", products: "قدم بعدی، یک ابزار بهتر.", productsBody: "تازه‌های فروشگاه برای میز کار شما.", why: "روی تعمیر تمرکز کنید.", whyAccent: "ما کنارتان هستیم.", cta: "از کجا شروع کنیم؟", skip: "رفتن به محتوا", journal: "مجله", rating: "امتیاز از ۵" },
  en: { title: "Good repairs start", accent: "with good support.", kicker: "The right tools. A clearer path.", body: "Specialist files, practical training, and professional tools. Everything you need for the next step in your repair.", browse: "Explore the shop", note: "For people who care about their craft", image: "A silver smartphone with disassembled components and a precision repair tool", caption: "Knowledge and tools, together.", tools: "At home with the tools you know", services: "A clearer path to every fix.", experts: "Experience on your side.", expertsBody: "Meet the people who know your device. Sometimes a conversation is all it takes to find the next step.", products: "Your next workbench essential.", productsBody: "The latest additions to the shop.", why: "Focus on the repair.", whyAccent: "We’re here for the rest.", cta: "Where shall we start?", skip: "Skip to content", journal: "Journal", rating: "Rating out of 5" },
  ar: { title: "صيانة احترافية،", accent: "مع الدعم المناسب.", kicker: "الأداة المناسبة. الطريق الأوضح.", body: "ملفات متخصصة وتدريب عملي وأدوات احترافية. كل ما تحتاجه للخطوة التالية في الصيانة.", browse: "اكتشف المنتجات", note: "لمن يهتمون بجودة عملهم", image: "هاتف فضي مع مكونات مفككة وأداة صيانة دقيقة", caption: "المعرفة والأدوات معًا.", tools: "مع الأدوات التي تعرفها", services: "لكل مشكلة، طريق أوضح.", experts: "خبرة تقف إلى جانبك.", expertsBody: "تعرف على متخصصي جهازك. أحيانًا تكفي محادثة لتوضيح الخطوة التالية.", products: "الأداة التالية لطاولة عملك.", productsBody: "أحدث الإضافات إلى المتجر.", why: "ركز على الصيانة.", whyAccent: "نحن بجانبك.", cta: "من أين نبدأ؟", skip: "انتقل إلى المحتوى", journal: "المجلة", rating: "التقييم من ٥" }
};

const serviceIcons: DesignIconName[] = ["headphones", "file", "layers"];

export function LandingPage({ locale, products, agents, accountHref }: LandingPageProps) {
  const c = copyByLocale[locale];
  const intro = introductions[locale];
  return (
    <div className={styles.page} dir={getDirection(locale)}>
      <LandingMotion />
      <a className="skip-link" href="#main-content">{intro.skip}</a>
      <PublicHeader locale={locale} accountHref={accountHref} />
      <main id="main-content">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>{intro.kicker}</p>
            <h1 id="hero-title">{intro.title}<span>{intro.accent}</span></h1>
            <p className={styles.heroBody}>{intro.body}</p>
            <div className={styles.heroActions}><Link className={styles.primary} href={localizedHref(locale, "/products")}>{intro.browse}<DesignIcon name="arrow" /></Link><a className={styles.secondary} href="#agents">{c.secondaryAction}</a></div>
            <p className={styles.heroNote}><DesignIcon name="check" />{intro.note}</p>
          </div>
          <figure className={styles.heroVisual}>
            <div className={styles.heroImage} data-home-image><Image src="/images/repair-studio.png" alt={intro.image} fill sizes="(max-width: 800px) 100vw, 55vw" priority /></div>
            <figcaption><span className={styles.captionIcon}><DesignIcon name="spark" /></span><span>{intro.caption}</span><span className={styles.imageSignature} translate="no">Top GSM Studio</span></figcaption>
          </figure>
        </section>
        <div className={styles.platforms}><p>{intro.tools}</p><div>{trustedTools.map((tool) => <span key={tool} translate="no">{tool}</span>)}</div></div>
        <section className={styles.section} id="services" aria-labelledby="services-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{c.services}</p><h2 id="services-title">{intro.services}</h2></div><p>{c.servicesBody}</p></div>
          <div className={styles.services}>{c.serviceCards.map((service, index) => <a className={styles.service} href={index === 0 ? "#agents" : `/${locale}/products`} key={service.title}><span className={styles.serviceIcon}><DesignIcon name={serviceIcons[index]} /></span><h3>{service.title}</h3><p>{service.body}</p><span className={styles.serviceAction}>{service.detail}<DesignIcon name="arrow" /></span></a>)}</div>
        </section>
        <section className={styles.shopSection} id="products" aria-labelledby="products-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{intro.productsBody}</p><h2 id="products-title">{intro.products}</h2></div><Link className={styles.textLink} href={localizedHref(locale, "/products")}>{c.viewAll}<DesignIcon name="arrow" /></Link></div>
          {products.length ? <div className={styles.products}>{products.slice(0, 4).map((product) => <Link className={styles.product} key={product.id} href={`/${locale}/products/${product.slug ?? product.id}` as Route}><div className={styles.productArtwork} data-type={product.type}><DesignIcon name={product.type === "digital" ? "file" : product.type === "service" ? "headphones" : "layers"} /><span>{productTypeLabel(product.type, locale)}</span></div><div className={styles.productInfo}><p>{product.category ?? productTypeLabel(product.type, locale)}</p><h3>{product.title}</h3><div><span>{formatPrice(product, locale)}</span><DesignIcon name="arrow" /></div></div></Link>)}</div> : <div className={styles.empty}><DesignIcon name="layers" /><p>{c.emptyProducts}</p></div>}
        </section>
        <section className={styles.section} id="agents" aria-labelledby="agents-title">
          <div className={styles.sectionHeading}><div><p className={styles.sectionLabel}>{c.navItems[3].label}</p><h2 id="agents-title">{intro.experts}</h2></div><p>{intro.expertsBody}</p></div>
          {agents.length ? <div className={styles.experts}>{agents.slice(0, 6).map((person) => <article className={styles.expert} key={person.id}><div className={styles.expertTop}><div className={styles.avatar} aria-hidden="true">{initials(person.name)}</div><span className={styles.rating} aria-label={`${intro.rating}: ${person.rating}`}><span aria-hidden="true">★</span> {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(person.rating)}</span></div><h3>{person.name}</h3><p>{person.specialty}</p><div className={styles.expertBottom}><span className={styles.availability} data-online={person.available === true}><i />{person.available ? c.availableText : c.unavailableText}</span>{person.phone ? <a href={`tel:${person.phone}`} aria-label={`${c.callText}: ${person.name}`}><DesignIcon name="arrow" /></a> : null}</div></article>)}</div> : <div className={styles.empty}><DesignIcon name="headphones" /><p>{c.emptyExperts}</p></div>}
        </section>
        <section className={styles.reassurance} aria-labelledby="why-title">
          <div><p className={styles.sectionLabel}>Top GSM</p><h2 id="why-title">{intro.why}<span>{intro.whyAccent}</span></h2><p className={styles.revealCopy} data-home-copy>{c.whyWords.map((word, index) => <span key={index} data-home-word>{word} </span>)}</p></div>
          <div className={styles.benefits}>{c.trust.slice(0, 3).map((benefit) => <div key={benefit.value}><span><DesignIcon name="check" /></span><div><h3>{benefit.value}</h3><p>{benefit.description}</p></div></div>)}</div>
        </section>
        <section className={styles.support} id="support"><span className={styles.supportIcon}><DesignIcon name="headphones" /></span><h2>{intro.cta}</h2><p>{c.ctaBody}</p><a className={styles.primary} href="tel:09925739312">{c.ctaAction}<DesignIcon name="arrow" /></a></section>
      </main>
      <footer className={styles.footer}><div><Link href={localizePath(locale) as Route} className={styles.footerBrand}>topgsm.</Link><p>{c.footerDescription}</p></div><nav aria-label={c.menuText}><Link href={localizedHref(locale, "/products")}>{intro.browse}</Link><Link href={localizedHref(locale, "/blog")}>{intro.journal}</Link><Link href={localizedHref(locale, "/seller-dashboard")}>{c.sellerDashboard}</Link><a href={accountHref ?? `/${locale}/login`}>{c.account}</a></nav><div className={styles.footerBottom}><span>© {new Date().getFullYear()} Top GSM</span><span>{c.brandDescription}</span></div></footer>
    </div>
  );
}
