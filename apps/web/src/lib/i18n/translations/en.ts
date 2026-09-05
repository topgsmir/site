export const en = {
  home: {
    title: "Welcome to TopGSM",
    description: "Multi-seller marketplace with digital, physical, and service products.",
    quick_access: "Quick access",
    products: "Browse products",
    choose_payment: "Choose payment method"
  },
  navigation: {
    sellerDashboard: "Seller dashboard",
    adminPanel: "Admin panel"
  },
  seller: {
    title: "Seller dashboard",
    products: "Your products",
    orders: "Orders",
    payoutRequests: "Payout requests"
  },
  admin: {
    title: "Admin dashboard",
    sellerInvites: "Seller onboarding requests",
    payoutReview: "Payout review",
    orderNotifications: "Order notifications"
  },
  payment: {
    methods: {
      localBank: {
        name: "Local bank gateway",
        description: "Pluggable local banking adapter."
      },
      nationalWallet: {
        name: "National wallet",
        description: "Wallet-based payment for local users."
      },
      cardGateway: {
        name: "Card gateway",
        description: "Pluggable local card processor."
      }
    }
  }
} as const;

