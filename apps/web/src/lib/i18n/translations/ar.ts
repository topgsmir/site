export const ar = {
  home: {
    title: "مرحبا بكم في TopGSM",
    description: "سوق متعدد البائعين للمنتجات الرقمية والمادية والخدمات.",
    quick_access: "وصول سريع",
    products: "تصفح المنتجات",
    choose_payment: "اختر طريقة الدفع"
  },
  navigation: {
    sellerDashboard: "لوحة البائع",
    adminPanel: "لوحة الإدارة"
  },
  seller: {
    title: "لوحة البائع",
    products: "منتجاتك",
    orders: "الطلبات",
    payoutRequests: "طلبات السحب"
  },
  admin: {
    title: "لوحة الإدارة",
    sellerInvites: "طلبات انضمام البائعين",
    payoutReview: "مراجعة المدفوعات",
    orderNotifications: "إشعارات الطلبات"
  },
  auth: {
    title: "تسجيل الدخول إلى حسابك",
    registerTitle: "إنشاء حساب",
    description: "أدخل بيانات حسابك للمتابعة.",
    registerDescription: "أنشئ حسابًا للشراء ومتابعة طلباتك.",
    fullName: "الاسم الكامل",
    identifier: "البريد الإلكتروني أو اسم المستخدم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginAction: "تسجيل الدخول",
    registerAction: "إنشاء الحساب",
    noAccount: "ليس لديك حساب؟",
    hasAccount: "لديك حساب بالفعل؟",
    switchToRegister: "إنشاء حساب",
    switchToLogin: "تسجيل الدخول",
    submitting: "يرجى الانتظار…",
    genericError: "تعذر إكمال الطلب. حاول مرة أخرى.",
    backHome: "العودة إلى الرئيسية",
    logoutAction: "تسجيل الخروج",
    loggingOut: "جارٍ تسجيل الخروج…",
    logoutError: "تعذر تسجيل الخروج. حاول مرة أخرى."
  },
  product: {
    skipToContent: "الانتقال إلى تفاصيل المنتج",
    home: "الرئيسية",
    backHome: "العودة إلى الرئيسية",
    cart: "السلة",
    language: "اللغة",
    signIn: "تسجيل الدخول",
    digital: "منتج رقمي",
    physical: "منتج فعلي",
    service: "خدمة عبر الإنترنت",
    uncategorized: "منتج متخصص للجوال",
    chooseOffer: "اختر عرضًا",
    offerHelp: "اختر الطراز والبائع اللذين تريد الشراء منهما.",
    seller: "البائع",
    variant: "الطراز",
    availability: "التوفر",
    inStock: "متوفر",
    outOfStock: "غير متوفر",
    addToCart: "أضف إلى السلة",
    adding: "جارٍ الإضافة…",
    added: "أُضيف إلى السلة",
    addFailed: "تعذر حفظ المنتج في هذا المتصفح. تحقق من أذونات التخزين وحاول مرة أخرى.",
    overview: "نظرة عامة على المنتج",
    noDescription: "لم يضف البائع وصفًا مفصلًا بعد. تحقق من الطراز وتفاصيل التنفيذ قبل الشراء.",
    technicalDetails: "التفاصيل الفنية",
    productType: "نوع المنتج",
    productCode: "رمز المنتج",
    category: "الفئة",
    fulfilment: "التنفيذ",
    digitalDelivery: "تسليم رقمي",
    physicalDelivery: "شحن منتج فعلي",
    serviceDelivery: "خدمة مجدولة",
    downloadLimit: "حد التنزيل",
    downloads: "تنزيلات",
    weight: "الوزن",
    grams: "غ",
    serviceType: "نوع الخدمة",
    estimatedTime: "الوقت التقديري",
    hours: "ساعات",
    priceAvailability: "يأتي السعر والتوفر مباشرة من عرض السوق النشط.",
    supportTitle: "لست متأكدًا من توافقه مع جهازك؟",
    supportBody: "تحقق من العنوان والطراز والبائع قبل إضافة المنتج. يمكن للمتخصص مساعدتك عند عدم وضوح التوافق.",
    contactSupport: "اتصل بالدعم",
    openingSupport: "جارٍ فتح الدعم…",
    supportError: "تعذر فتح الدعم. حاول مرة أخرى.",
    footerDescription: "ملفات وأدوات وخدمات متخصصة لمحترفي صيانة الجوال.",
    itemCount: "منتجات في السلة",
    notFoundTitle: "المنتج غير موجود",
    notFoundBody: "قد يكون المنتج غير منشور أو تغير عنوانه."
  },
  payment: {
    methods: {
      localBank: {
        name: "بوابة مصرفية محلية",
        description: "محول مصرفي محلي قابل للربط."
      },
      nationalWallet: {
        name: "محفظة وطنية",
        description: "دفع عبر المحفظة للمستخدمين المحليين."
      },
      cardGateway: {
        name: "بوابة البطاقات",
        description: "معالج بطاقات محلي قابل للربط."
      }
    }
  }
} as const;
