import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties } from "react";
import { getDirection, localizePath, type Locale } from "@/lib/i18n";
import { LandingMotion } from "./LandingMotion";

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
    heroKicker: "از سال ۱۳۹۳، کنار تعمیرکاران ایران",
    heroTitleLead: "هر چیزی که برای تعمیر موبایل لازم دارید؛",
    heroTitleAccent: "یک‌جا و مطمئن.",
    heroBody: "فایل تست‌شده، آموزش کاربردی، لایسنس ابزار و پشتیبانی آنلاین را سریع پیدا کنید و مستقیم از متخصص همان حوزه کمک بگیرید.",
    primaryAction: "جست‌وجوی محصولات",
    secondaryAction: "درخواست پشتیبانی",
    liveDesk: "میز پشتیبانی آنلاین",
    responseLabel: "میانگین شروع پاسخ",
    responseValue: "کمتر از ۵ دقیقه",
    completedLabel: "وضعیت سرویس‌ها",
    completedValue: "فعال و در دسترس",
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
    productsTitle: "تازه‌ترین فایل‌ها و آموزش‌ها",
    productsBody: "محصولات این بخش مستقیم از فروشگاه بارگذاری می‌شوند و همیشه تازه‌اند.",
    viewAll: "مشاهده همه محصولات",
    emptyProducts: "هنوز محصولی منتشر نشده است.",
    whyTitle: "برای تعمیرکار ساخته شده، نه برای پیچیده‌تر کردن کار.",
    whyWords: ["فایل‌های", "کنترل‌شده،", "پاسخ‌گویی", "تخصصی", "و", "پیگیری", "شفاف؛", "تا", "وقت", "شما", "صرف", "تعمیر", "شود،", "نه", "جست‌وجو."],
    trust: [
      { value: "+۱۲", description: "سال تجربه در بازار تعمیرات موبایل" },
      { value: "+۲۰", description: "کارشناس نرم‌افزار، سخت‌افزار و فروش" },
      { value: "۲۴/۷", description: "ثبت سفارش و دسترسی به فایل‌ها" },
      { value: "QC", description: "کنترل کیفیت سرویس‌های حساس" }
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
    heroKicker: "Supporting repair professionals since 2014",
    heroTitleLead: "Everything mobile repair needs,",
    heroTitleAccent: "in one trusted place.",
    heroBody: "Find verified files, practical training, tool licenses, and direct support from the right specialist.",
    primaryAction: "Search products",
    secondaryAction: "Get support",
    liveDesk: "Live support desk",
    responseLabel: "Average first response",
    responseValue: "Under 5 minutes",
    completedLabel: "Service status",
    completedValue: "Online and available",
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
    productsTitle: "Latest files and training",
    productsBody: "This collection is loaded directly from the marketplace and stays current.",
    viewAll: "View all products",
    emptyProducts: "No products have been published yet.",
    whyTitle: "Built for repair professionals, not to add more friction.",
    whyWords: ["Verified", "files,", "specialist", "answers,", "and", "clear", "tracking", "keep", "your", "time", "focused", "on", "the", "repair."],
    trust: [
      { value: "12+", description: "years in the mobile repair market" },
      { value: "20+", description: "software, hardware, and sales specialists" },
      { value: "24/7", description: "ordering and file access" },
      { value: "QC", description: "quality checks for sensitive services" }
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
    heroKicker: "مع متخصصي الصيانة منذ 2014",
    heroTitleLead: "كل ما تحتاجه لصيانة الجوال،",
    heroTitleAccent: "في مكان واحد موثوق.",
    heroBody: "اعثر على ملفات موثوقة وتدريب عملي وتراخيص أدوات ودعم مباشر من المتخصص المناسب.",
    primaryAction: "ابحث في المنتجات",
    secondaryAction: "اطلب الدعم",
    liveDesk: "مكتب الدعم المباشر",
    responseLabel: "متوسط بدء الرد",
    responseValue: "أقل من 5 دقائق",
    completedLabel: "حالة الخدمات",
    completedValue: "متاحة الآن",
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
    productsTitle: "أحدث الملفات والدروس",
    productsBody: "تُحمّل هذه المجموعة مباشرة من المتجر وتبقى محدثة.",
    viewAll: "عرض كل المنتجات",
    emptyProducts: "لم يُنشر أي منتج بعد.",
    whyTitle: "مصمم للمتخصص، لا لتعقيد عمله.",
    whyWords: ["ملفات", "موثوقة،", "إجابات", "متخصصة", "ومتابعة", "واضحة", "لتبقى", "مركزاً", "على", "الصيانة."],
    trust: [
      { value: "+12", description: "عاماً في سوق صيانة الجوال" },
      { value: "+20", description: "متخصصاً في البرمجيات والعتاد والمبيعات" },
      { value: "24/7", description: "للطلب والوصول إلى الملفات" },
      { value: "QC", description: "لفحص جودة الخدمات الحساسة" }
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

const fallbackAgents: HomepageAgent[] = [
  { id: "nima", name: "نیما رسولی", specialty: "کارشناس شیائومی", rating: 4.9, available: true },
  { id: "ali", name: "علی عبدی", specialty: "کارشناس سامسونگ", rating: 4.8, available: true },
  { id: "hesam", name: "حسام امینی", specialty: "کارشناس عمومی", rating: 4.8, available: false },
  { id: "hossein", name: "حسین کاری", specialty: "برندهای چینی", rating: 4.7, available: true }
];

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
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : locale === "ar" ? "ar" : "en", { maximumFractionDigits: 0 }).format(product.price) + (locale === "fa" ? " تومان" : ` ${product.currency ?? "IRR"}`);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("");
}

function localizedHref(locale: Locale, href: string) {
  return localizePath(locale, href) as Route;
}

function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <div className="language-switcher" aria-label="Language">
      {(["fa", "en", "ar"] as Locale[]).map((code) => (
        <Link key={code} href={localizePath(code) as Route} className={code === locale ? "is-active" : undefined} aria-current={code === locale ? "page" : undefined} hrefLang={code}>
          {code.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}

export function LandingPage({ locale, products, agents, accountHref }: LandingPageProps) {
  const copy = copyByLocale[locale];
  const visibleAgents = agents.length ? agents.slice(0, 6) : fallbackAgents;
  const visibleProducts = products.slice(0, 8);

  return (
    <div className="home-shell" dir={getDirection(locale)} lang={locale}>
      <LandingMotion />
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <Link className="brand-lockup" href={localizePath(locale) as Route} aria-label="Top GSM home">
          <Image src="/brand/topgsm-logo.jpg" alt="" width={48} height={48} priority />
          <span><strong>TOP GSM</strong><small>{copy.brandDescription}</small></span>
        </Link>
        <nav className="main-nav" aria-label={copy.menuText}>
          {copy.navItems.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher locale={locale} />
          <a className="login-link" href={accountHref ?? `/${locale}/login`}>
            {accountHref ? copy.myAccountText : copy.loginText}
          </a>
          <a className="cart-link" href="#cart" aria-label={copy.cartText}><span>{copy.cartText}</span><b>۰</b></a>
        </div>
      </header>

      <main id="main-content" className="landing-main">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow" data-hero-reveal>{copy.heroKicker}</p>
            <h1 id="hero-title" data-hero-reveal>
              {copy.heroTitleLead}
              <span className="hero-title-accent"><span className="inline-logo" aria-hidden="true"><Image src="/brand/topgsm-logo.jpg" alt="" width={76} height={34} priority /></span>{copy.heroTitleAccent}</span>
            </h1>
            <p className="hero-body" data-hero-reveal>{copy.heroBody}</p>
            <form className="hero-search" role="search" action={`/${locale}/search`} method="get" data-hero-reveal>
              <label className="sr-only" htmlFor="home-search">{copy.searchLabel}</label>
              <input id="home-search" name="q" type="search" placeholder={copy.searchPlaceholder} autoComplete="off" />
              <button type="submit">{copy.primaryAction}</button>
            </form>
            <div className="hero-actions" data-hero-reveal>
              <a className="text-action" href="#support">{copy.secondaryAction}<span aria-hidden="true">←</span></a>
              <span className="service-pulse"><i aria-hidden="true" />{copy.completedValue}</span>
            </div>
          </div>

          <div className="hero-visual" aria-label={copy.liveDesk} data-hero-reveal>
            <div className="device-board" aria-hidden="true">
              <span className="board-orbit orbit-one" /><span className="board-orbit orbit-two" />
              <div className="board-chip"><span>TOP</span><strong>GSM</strong></div>
              <i className="trace trace-a" /><i className="trace trace-b" /><i className="trace trace-c" />
              <i className="node node-a" /><i className="node node-b" /><i className="node node-c" />
            </div>
            <div className="support-card">
              <div><span className="status-dot" />{copy.liveDesk}</div>
              <dl><div><dt>{copy.responseLabel}</dt><dd>{copy.responseValue}</dd></div><div><dt>{copy.completedLabel}</dt><dd>{copy.completedValue}</dd></div></dl>
            </div>
          </div>
        </section>

        <section className="tools-marquee" aria-label="Supported platforms">
          <div className="marquee-track">{[...trustedTools, ...trustedTools].map((tool, index) => <span key={`${tool}-${index}`} aria-hidden={index >= trustedTools.length}>{tool}</span>)}</div>
        </section>

        <section className="chapter services-section" id="services" aria-labelledby="services-title">
          <div className="section-intro"><h2 id="services-title">{copy.servicesTitle}</h2><p>{copy.servicesBody}</p></div>
          <div className="service-bento">
            {copy.serviceCards.map((service, index) => (
              <a className={`service-card service-card-${index + 1}`} href={service.href} key={service.title}>
                <div><h3>{service.title}</h3><p>{service.body}</p></div>
                <strong>{service.detail}<span aria-hidden="true">←</span></strong>
              </a>
            ))}
          </div>
        </section>

        <section className="chapter experts-section" id="agents" aria-labelledby="agents-title">
          <div className="section-intro section-intro-split"><h2 id="agents-title">{copy.expertsTitle}</h2><p>{copy.expertsBody}</p></div>
          <div className="expert-stack">
            {visibleAgents.map((agent, index) => (
              <article className="expert-card" data-stack-card key={agent.id} style={{ "--stack-index": index } as CSSProperties}>
                <div className="expert-avatar" aria-hidden="true"><span>{initials(agent.name)}</span></div>
                <div className="expert-copy">
                  <span className={`availability ${agent.available ? "is-online" : ""}`}><i aria-hidden="true" />{agent.available ? copy.availableText : copy.unavailableText}</span>
                  <h3>{agent.name}</h3><p>{agent.specialty}</p>
                </div>
                <div className="expert-score"><span>{agent.rating.toFixed(1)}</span><small>از ۵</small></div>
                {agent.phone ? <a className="expert-call" href={`tel:${agent.phone}`}>{copy.callText}</a> : null}
              </article>
            ))}
          </div>
        </section>

        <section className="chapter products-section" id="products" aria-labelledby="products-title">
          <div className="section-intro section-intro-split">
            <h2 id="products-title">{copy.productsTitle}</h2>
            <div><p>{copy.productsBody}</p><a className="outline-action" href={`/${locale}/products`}>{copy.viewAll}<span aria-hidden="true">←</span></a></div>
          </div>
          {visibleProducts.length ? (
            <div className="product-grid">
              {visibleProducts.map((product, index) => (
                <article className="product-card" key={product.id}>
                  <Link href={`/${locale}/products/${product.slug ?? product.id}` as Route} aria-label={product.title}>
                    <div className={`product-visual product-visual-${(index % 4) + 1}`} data-product-visual aria-hidden="true"><span className="product-device" /><i /><b>{product.type.toUpperCase()}</b></div>
                    <div className="product-info"><span>{product.category ?? productTypeLabel(product.type, locale)}</span><h3>{product.title}</h3><strong>{formatPrice(product, locale)}</strong></div>
                  </Link>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">{copy.emptyProducts}</p>}
        </section>

        <section className="chapter trust-section" aria-labelledby="why-title">
          <div className="trust-copy">
            <h2 id="why-title">{copy.whyTitle}</h2>
            <p className="reveal-copy" data-reveal-copy>{copy.whyWords.map((word, index) => <span data-reveal-word key={`${word}-${index}`}>{word} </span>)}</p>
          </div>
          <dl className="trust-grid">{copy.trust.map((item) => <div key={item.value}><dt>{item.value}</dt><dd>{item.description}</dd></div>)}</dl>
        </section>

        <section className="support-cta" id="support" aria-labelledby="support-title">
          <div><h2 id="support-title">{copy.ctaTitle}</h2><p>{copy.ctaBody}</p></div>
          <a href="tel:09925739312">{copy.ctaAction}<span aria-hidden="true">←</span></a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand"><strong>TOP GSM</strong><p>{copy.footerDescription}</p><small>© {new Date().getFullYear()} Top GSM</small></div>
        <div><h3>{copy.quickAccess}</h3><a href="#products">{copy.productsTitle}</a><a href="#agents">{copy.expertsTitle}</a><a href="#support">{copy.ctaAction}</a></div>
        <div><h3>{copy.services}</h3>{copy.serviceCards.map((item) => <a key={item.title} href={item.href}>{item.title}</a>)}</div>
        <div><h3>{copy.account}</h3><a href={accountHref ?? `/${locale}/login`}>{accountHref ? copy.myAccountText : copy.loginText}</a><Link href={localizedHref(locale, "/seller-dashboard")}>{copy.sellerDashboard}</Link><a href="#cart">{copy.cartText}</a></div>
      </footer>
    </div>
  );
}
