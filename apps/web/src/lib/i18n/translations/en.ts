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
  product: {
    skipToContent: "Skip to product details",
    home: "Home",
    backHome: "Back to home",
    cart: "Cart",
    language: "Language",
    signIn: "Sign in",
    digital: "Digital product",
    physical: "Physical product",
    service: "Online service",
    uncategorized: "GSM product",
    chooseOffer: "Choose an offer",
    offerHelp: "Select the variant and seller you want to buy from.",
    seller: "Seller",
    variant: "Variant",
    availability: "Availability",
    inStock: "In stock",
    outOfStock: "Out of stock",
    addToCart: "Add to cart",
    adding: "Adding…",
    added: "Added to cart",
    addFailed: "The item could not be saved in this browser. Check storage permissions and try again.",
    overview: "Product overview",
    noDescription: "The seller has not added a detailed description yet. Confirm the variant and fulfilment details before buying.",
    technicalDetails: "Technical details",
    productType: "Product type",
    productCode: "Product code",
    category: "Category",
    fulfilment: "Fulfilment",
    digitalDelivery: "Digital delivery",
    physicalDelivery: "Physical delivery",
    serviceDelivery: "Scheduled service",
    downloadLimit: "Download limit",
    downloads: "downloads",
    weight: "Weight",
    grams: "g",
    serviceType: "Service type",
    estimatedTime: "Estimated time",
    hours: "hours",
    priceAvailability: "Price and availability come directly from the active marketplace offer.",
    supportTitle: "Not sure this matches your device?",
    supportBody: "Check the title, variant and seller before adding the product. A specialist can help when the fit is unclear.",
    contactSupport: "Contact support",
    openingSupport: "Opening support…",
    supportError: "Support could not be opened. Please try again.",
    footerDescription: "Specialist files, tools and services for mobile repair professionals.",
    itemCount: "items in cart",
    notFoundTitle: "Product not found",
    notFoundBody: "This product may be unpublished or the address may have changed."
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
