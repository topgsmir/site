export const fa = {
  home: {
    title: "به TopGSM خوش آمدید",
    description: "چندفروشنده، محصولات دانلودی، فیزیکی و خدمات آنلاین.",
    quick_access: "دسترسی سریع",
    products: "مرور محصولات",
    choose_payment: "انتخاب روش پرداخت"
  },
  navigation: {
    sellerDashboard: "پنل فروشنده",
    adminPanel: "پنل مدیریت"
  },
  seller: {
    title: "پنل فروشنده",
    products: "محصولات شما",
    orders: "سفارشات",
    payoutRequests: "درخواست برداشت"
  },
  admin: {
    title: "پنل مدیریت",
    sellerInvites: "درخواست‌ها و تایید فروشندگان",
    payoutReview: "بررسی درخواست‌های تسویه",
    orderNotifications: "اعلان‌های سفارش"
  },
  auth: {
    title: "ورود به حساب کاربری",
    registerTitle: "ساخت حساب کاربری",
    description: "برای ادامه، اطلاعات حساب خود را وارد کنید.",
    registerDescription: "با ساخت حساب، خرید و پیگیری سفارش‌ها ساده‌تر می‌شود.",
    fullName: "نام و نام خانوادگی",
    identifier: "ایمیل یا نام کاربری",
    email: "ایمیل",
    password: "رمز عبور",
    loginAction: "ورود",
    registerAction: "ساخت حساب",
    noAccount: "هنوز حساب ندارید؟",
    hasAccount: "قبلاً حساب ساخته‌اید؟",
    switchToRegister: "ثبت‌نام",
    switchToLogin: "ورود",
    submitting: "کمی صبر کنید…",
    genericError: "امکان انجام درخواست وجود ندارد. دوباره تلاش کنید.",
    backHome: "بازگشت به صفحه اصلی",
    logoutAction: "خروج",
    loggingOut: "در حال خروج…",
    logoutError: "خروج از حساب انجام نشد. دوباره تلاش کنید."
  },
  product: {
    skipToContent: "رفتن به جزئیات محصول",
    home: "صفحه اصلی",
    backHome: "بازگشت به خانه",
    cart: "سبد خرید",
    language: "زبان",
    signIn: "ورود",
    digital: "محصول دیجیتال",
    physical: "کالای فیزیکی",
    service: "خدمات آنلاین",
    uncategorized: "محصول تخصصی موبایل",
    chooseOffer: "انتخاب پیشنهاد فروش",
    offerHelp: "مدل و فروشنده موردنظر برای خرید را انتخاب کنید.",
    seller: "فروشنده",
    variant: "مدل",
    availability: "موجودی",
    inStock: "موجود",
    outOfStock: "ناموجود",
    addToCart: "افزودن به سبد",
    adding: "در حال افزودن…",
    added: "به سبد اضافه شد",
    addFailed: "ذخیره محصول در این مرورگر انجام نشد. دسترسی حافظه مرورگر را بررسی و دوباره تلاش کنید.",
    overview: "معرفی محصول",
    noDescription: "فروشنده هنوز توضیح کامل ثبت نکرده است. پیش از خرید، مدل و جزئیات تحویل را بررسی کنید.",
    technicalDetails: "مشخصات فنی",
    productType: "نوع محصول",
    productCode: "کد محصول",
    category: "دسته‌بندی",
    fulfilment: "روش تحویل",
    digitalDelivery: "تحویل دیجیتال",
    physicalDelivery: "ارسال کالای فیزیکی",
    serviceDelivery: "انجام خدمات",
    downloadLimit: "تعداد مجاز دانلود",
    downloads: "بار",
    weight: "وزن",
    grams: "گرم",
    serviceType: "نوع خدمت",
    estimatedTime: "زمان تخمینی",
    hours: "ساعت",
    priceAvailability: "قیمت و موجودی مستقیماً از پیشنهاد فعال بازار دریافت می‌شود.",
    supportTitle: "از سازگاری با دستگاه مطمئن نیستید؟",
    supportBody: "پیش از افزودن محصول، عنوان، مدل و فروشنده را بررسی کنید. در صورت ابهام، متخصص راهنمایی‌تان می‌کند.",
    contactSupport: "تماس با پشتیبانی",
    openingSupport: "در حال باز کردن پشتیبانی…",
    supportError: "پشتیبانی باز نشد. دوباره تلاش کنید.",
    footerDescription: "فایل، ابزار و خدمات تخصصی برای تعمیرکاران موبایل.",
    itemCount: "محصول در سبد",
    notFoundTitle: "محصول پیدا نشد",
    notFoundBody: "ممکن است محصول از انتشار خارج شده یا نشانی آن تغییر کرده باشد."
  },
  payment: {
    methods: {
      localBank: {
        name: "درگاه بانکی داخلی",
        description: "اتصال به درگاه بانکی پلتفرم شما"
      },
      nationalWallet: {
        name: "کیف پول داخلی",
        description: "امکان پرداخت با کیف پول داخلی"
      },
      cardGateway: {
        name: "درگاه کارت",
        description: "انتخاب کانال کارت اعتباری/نقدی داخلی"
      }
    }
  }
} as const;
