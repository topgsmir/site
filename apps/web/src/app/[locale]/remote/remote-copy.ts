import type { Locale } from "@/lib/i18n";

export type RemoteBenefit = { title: string; body: string; icon: "check" | "spark" | "headphones" | "layers" };
export type RemoteStep = { title: string; body: string };
export type RemoteRate = {
  level: string;
  price: string;
  software: string;
  hardware: string;
};

export const remoteCopy = {
  fa: {
    title: "تعمیرات موبایل از راه دور",
    home: "صفحه اصلی",
    skip: "رفتن به محتوای اصلی",
    label: "خدمات ریموت",
    heading: "تعمیرات موبایل",
    accent: "از راه دور",
    description: "روی سیستم خودتان، با کارشناس متخصص برند، مشکل نرم‌افزاری یا سخت‌افزاری گوشی را برطرف کنید؛ بدون ارسال دستگاه.",
    primaryCta: "انتخاب کارشناس",
    secondaryCta: "مشاهده خدمات فروشگاه",
    photoAlt: "پشتیبانی فنی موبایل از راه دور در تاپ جی‌اس‌ام",
    benefitsTitle: "چرا ریموت؟",
    benefits: [
      { title: "امنیت اطلاعات", body: "کار روی سیستم خودتان و جلوی چشم شما انجام می‌شود.", icon: "check" },
      { title: "هزینه شفاف", body: "تعرفه‌های ثبت‌شده کمتر از مراجعه حضوری معمول است.", icon: "spark" },
      { title: "تخصص بر اساس برند", body: "برای هر برند، کارشناس همان حوزه را انتخاب کنید.", icon: "layers" },
      { title: "پیگیری شکایات", body: "واحد رسیدگی به شکایات برای پیگیری کیفیت کار فعال است.", icon: "headphones" }
    ] satisfies RemoteBenefit[],
    processTitle: "روش کار",
    processBody: "کارشناس را انتخاب کنید، هماهنگ شوید، هزینه را بپردازید و کار را شروع کنید. کارشناس می‌تواند کمتر از تعرفه بگیرد، نه بیشتر.",
    steps: [
      { title: "کارشناس را انتخاب کنید", body: "بر اساس برند یا نوع مشکل، پروفایل مناسب را باز کنید." },
      { title: "هماهنگی کوتاه", body: "از طریق تماس یا پیام، مدل و وضعیت دستگاه را هماهنگ کنید." },
      { title: "پرداخت و شروع کار", body: "پس از پرداخت طبق تعرفه، کارشناس روی سیستم شما کار را انجام می‌دهد." }
    ] satisfies RemoteStep[],
    expertsTitle: "کارشناسان ریموت",
    expertsBody: "کارشناس مناسب را انتخاب کنید و گفت‌وگو را در Goghdi آغاز کنید.",
    startChat: "شروع گفتگو",
    openingChat: "در حال اتصال…",
    chatUnavailable: "گفت‌وگو برای این کارشناس فعال نیست.",
    chatError: "گفت‌وگو باز نشد. دوباره تلاش کنید.",
    expertFallback: "کارشناس تاپ جی‌اس‌ام",
    emptyExperts: "هنوز کارشناسی برای نمایش وجود ندارد.",
    expertsUnavailable: "فهرست کارشناسان بارگذاری نشد. کمی بعد دوباره تلاش کنید یا از صفحه تماس استفاده کنید.",
    ratesTitle: "تعرفه‌ها",
    ratesBody: "مبالغ به‌صورت هزار تومان اعلام شده‌اند. جزئیات دقیق هر سطح را قبل از پرداخت با کارشناس مرور کنید.",
    softwareLabel: "نرم‌افزار",
    hardwareLabel: "سخت‌افزار",
    rates: [
      {
        level: "سطح ۱",
        price: "۴۰ هزار تومان",
        software: "حل مشکل گوگل‌پلی، فلش چینی بدون هزینه فایل، فارسی‌سازی، روت مدل‌های قبل از ۲۰۲۰، مشکلات KG و RMM",
        hardware: "تعمیر سیم‌کارت‌خور، عدم شارژ، عدم شناسایی مموری، قطعی صدای مکالمه، خرابی کلیدها"
      },
      {
        level: "سطح ۲",
        price: "۷۰ هزار تومان",
        software: "رایت فایل‌های خاص شیائومی (EFS، ENG و …)، روت شیائومی، آنلاک بوت‌لودر، بک‌آپ، بازیابی میاکانت",
        hardware: "خرابی آی‌سی‌های charge، power، RF، PF، Wi-Fi و touch؛ اهم‌گیری و جایگذاری"
      },
      {
        level: "سطح ۳",
        price: "۱۲۰ هزار تومان",
        software: "مشکلات اکانت گوگل، سامسونگ و میاکانت؛ باز کردن قفل بدون پاک شدن اطلاعات؛ ریکاوری اطلاعات؛ ترمیم سریال",
        hardware: "خدمات سخت‌افزاری پیچیده‌تر مطابق هماهنگی با کارشناس همان سطح"
      }
    ] satisfies RemoteRate[],
    setupTitle: "آماده شروع؟",
    setupBody: "AnyDesk را روی رایانه نصب کنید، کارشناس را انتخاب کنید و هماهنگی را آغاز کنید. بقیه مسیر با راهنمایی کارشناس پیش می‌رود.",
    setupDownload: "دانلود AnyDesk",
    setupContact: "تماس با پشتیبانی",
    anydeskUrl: "https://anydesk.com/download"
  },
  en: {
    title: "Remote mobile repair",
    home: "Home",
    skip: "Skip to main content",
    label: "Remote services",
    heading: "Mobile repair,",
    accent: "done remotely",
    description: "A brand specialist works on your own computer to resolve software or hardware phone issues, without shipping the device.",
    primaryCta: "Choose an expert",
    secondaryCta: "Browse store services",
    photoAlt: "Remote mobile technical support at Top GSM",
    benefitsTitle: "Why remote?",
    benefits: [
      { title: "Data stays with you", body: "Work happens on your system, in front of you.", icon: "check" },
      { title: "Clear pricing", body: "Published rates are usually lower than a typical shop visit.", icon: "spark" },
      { title: "Brand specialists", body: "Pick the expert who works that brand every day.", icon: "layers" },
      { title: "Complaint follow-up", body: "A complaints desk can review quality concerns.", icon: "headphones" }
    ] satisfies RemoteBenefit[],
    processTitle: "How it works",
    processBody: "Choose an expert, coordinate briefly, pay the listed rate, then start. Experts may charge less than the tariff, never more.",
    steps: [
      { title: "Pick an expert", body: "Open the profile that matches your brand or issue." },
      { title: "Short coordination", body: "Share the model and current device state by call or message." },
      { title: "Pay and begin", body: "After payment at the listed rate, the expert works on your PC." }
    ] satisfies RemoteStep[],
    expertsTitle: "Remote specialists",
    expertsBody: "Choose the right specialist and start a Goghdi conversation with them.",
    startChat: "Start chat",
    openingChat: "Connecting…",
    chatUnavailable: "Chat is not available for this specialist.",
    chatError: "Could not open chat. Try again.",
    expertFallback: "Top GSM expert",
    emptyExperts: "No experts are available yet.",
    expertsUnavailable: "The expert directory could not be loaded. Try again later or use the contact page.",
    ratesTitle: "Rates",
    ratesBody: "Amounts are shown in thousand tomans. Confirm the exact scope with your expert before paying.",
    softwareLabel: "Software",
    hardwareLabel: "Hardware",
    rates: [
      {
        level: "Level 1",
        price: "40,000 toman",
        software: "Google Play issues, Chinese flash without file fee, Persian localization, root for pre-2020 models, KG and RMM issues",
        hardware: "SIM slot repair, no-charge faults, memory not detected, call audio cuts, key failures"
      },
      {
        level: "Level 2",
        price: "70,000 toman",
        software: "Xiaomi special files (EFS, ENG, …), Xiaomi root, bootloader unlock, backup, Mi Account recovery",
        hardware: "Charge, power, RF, PF, Wi-Fi and touch IC faults; measurement and replacement"
      },
      {
        level: "Level 3",
        price: "120,000 toman",
        software: "Google, Samsung and Mi account issues; unlock without data wipe; data recovery; serial repair",
        hardware: "More complex hardware work, agreed with the matching Level 3 specialist"
      }
    ] satisfies RemoteRate[],
    setupTitle: "Ready to start?",
    setupBody: "Install AnyDesk on your computer, choose an expert, and begin coordination. The specialist guides the rest.",
    setupDownload: "Download AnyDesk",
    setupContact: "Contact support",
    anydeskUrl: "https://anydesk.com/download"
  },
  ar: {
    title: "صيانة الجوال عن بُعد",
    home: "الرئيسية",
    skip: "انتقل إلى المحتوى الرئيسي",
    label: "الخدمات عن بُعد",
    heading: "صيانة الجوال",
    accent: "عن بُعد",
    description: "يعمل مختص العلامة على جهازك عبر حاسوبك لحل مشكلات البرمجيات أو العتاد، دون إرسال الجهاز.",
    primaryCta: "اختر خبيرًا",
    secondaryCta: "تصفح خدمات المتجر",
    photoAlt: "الدعم الفني للجوال عن بُعد في Top GSM",
    benefitsTitle: "لماذا عن بُعد؟",
    benefits: [
      { title: "أمان البيانات", body: "يتم العمل على نظامك وأمامك مباشرة.", icon: "check" },
      { title: "تسعير واضح", body: "التعرفات المنشورة أقل عادة من زيارة المحل.", icon: "spark" },
      { title: "تخصص حسب العلامة", body: "اختر الخبير المناسب لعلامتك التجارية.", icon: "layers" },
      { title: "متابعة الشكاوى", body: "وحدة الشكاوى تتابع جودة الخدمة عند الحاجة.", icon: "headphones" }
    ] satisfies RemoteBenefit[],
    processTitle: "طريقة العمل",
    processBody: "اختر الخبير، نسّق باختصار، ادفع وفق التعرفة، ثم ابدأ. يمكن للخبير أن يأخذ أقل من التعرفة، لا أكثر.",
    steps: [
      { title: "اختر الخبير", body: "افتح الملف المناسب لعلامتك أو مشكلتك." },
      { title: "تنسيق قصير", body: "شارك الطراز وحالة الجهاز عبر اتصال أو رسالة." },
      { title: "الدفع والبدء", body: "بعد الدفع وفق التعرفة، يعمل الخبير على حاسوبك." }
    ] satisfies RemoteStep[],
    expertsTitle: "خبراء الخدمة عن بُعد",
    expertsBody: "اختر المختص المناسب وابدأ محادثة Goghdi معه.",
    startChat: "بدء المحادثة",
    openingChat: "جارٍ الاتصال…",
    chatUnavailable: "المحادثة غير متاحة لهذا المختص.",
    chatError: "تعذر فتح المحادثة. حاول مجددًا.",
    expertFallback: "خبير Top GSM",
    emptyExperts: "لا يوجد خبراء للعرض حاليًا.",
    expertsUnavailable: "تعذر تحميل قائمة الخبراء. حاول لاحقًا أو استخدم صفحة الاتصال.",
    ratesTitle: "التعرفات",
    ratesBody: "المبالغ بآلاف التومان. راجع نطاق العمل مع الخبير قبل الدفع.",
    softwareLabel: "برمجيات",
    hardwareLabel: "عتاد",
    rates: [
      {
        level: "المستوى ١",
        price: "٤٠ ألف تومان",
        software: "مشاكل Google Play، فلاش صيني دون رسوم ملف، التعريب، روت ما قبل ٢٠٢٠، مشاكل KG و RMM",
        hardware: "إصلاح منفذ الشريحة، عدم الشحن، عدم التعرف على الذاكرة، انقطاع صوت المكالمة، أعطال الأزرار"
      },
      {
        level: "المستوى ٢",
        price: "٧٠ ألف تومان",
        software: "ملفات شاومي الخاصة (EFS و ENG و…)، روت شاومي، فتح البوت لودر، النسخ الاحتياطي، استعادة حساب Mi",
        hardware: "أعطال شرائح charge و power و RF و PF و Wi-Fi و touch؛ القياس والاستبدال"
      },
      {
        level: "المستوى ٣",
        price: "١٢٠ ألف تومان",
        software: "مشاكل حسابات Google و Samsung و Mi؛ فتح القفل دون مسح البيانات؛ استعادة البيانات؛ إصلاح السيريال",
        hardware: "أعمال عتاد أكثر تعقيدًا بالتنسيق مع خبير المستوى ٣"
      }
    ] satisfies RemoteRate[],
    setupTitle: "هل أنت مستعد؟",
    setupBody: "ثبّت AnyDesk على الحاسوب، اختر خبيرًا، وابدأ التنسيق. يرشدك المختص في بقية الخطوات.",
    setupDownload: "تنزيل AnyDesk",
    setupContact: "تواصل مع الدعم",
    anydeskUrl: "https://anydesk.com/download"
  }
} as const satisfies Record<Locale, Record<string, unknown>>;
