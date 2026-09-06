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
