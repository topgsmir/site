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
