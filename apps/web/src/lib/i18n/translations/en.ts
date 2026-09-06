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
  auth: {
    title: "Sign in to your account",
    registerTitle: "Create your account",
    description: "Enter your account details to continue.",
    registerDescription: "Create an account to buy and track your orders.",
    fullName: "Full name",
    identifier: "Email or username",
    email: "Email",
    password: "Password",
    loginAction: "Sign in",
    registerAction: "Create account",
    noAccount: "New to Top GSM?",
    hasAccount: "Already have an account?",
    switchToRegister: "Create an account",
    switchToLogin: "Sign in",
    submitting: "Please wait…",
    genericError: "We could not complete the request. Please try again.",
    backHome: "Back to home",
    logoutAction: "Log out",
    loggingOut: "Logging out…",
    logoutError: "We could not log you out. Please try again."
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
