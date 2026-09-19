export type ProductType = "digital" | "physical" | "service" | "bridge";
export type ProductKind = "simple" | "variable";
export type ProductStatus = "draft" | "pending_review" | "active" | "archived";
export type SellerListingStatus = "draft" | "active" | "archived";

export interface ProductOptionSelection {
  name: string;
  value: string;
}

export interface ProductStartingPrice {
  currency: string;
  price: string;
}

export interface ProductImage {
  id: string;
  variants: Array<{
    name: "thumb" | "large";
    url: string;
    width: number;
    height: number;
  }>;
}

export interface PublicProductSummary {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  kind: ProductKind;
  type: ProductType;
  image: ProductImage | null;
  price?: string;
  currency?: string;
  startingPrices: ProductStartingPrice[];
  createdAt: string;
}

export interface PublicSellerOffer {
  id: string;
  price: string;
  currency: string;
  seller: { id: string; shopName: string };
  digital?: { maxDownloads: number };
  physical?: { inStock: boolean; weightGrams: number };
  service?: { serviceType: string; estimatedHours: number };
}

export interface PublicProductVariant {
  id: string;
  name: string | null;
  options: ProductOptionSelection[];
  offers: PublicSellerOffer[];
}

export interface PublicProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  kind: ProductKind;
  type: ProductType;
  image: ProductImage | null;
  bridge?: PublicBridgeProduct;
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string }>;
  }>;
  variants: PublicProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerProductOffer {
  id: string;
  variant: {
    id: string;
    name: string | null;
    options: ProductOptionSelection[];
  };
  price: string;
  currency: string;
  sellerSku: string | null;
  status: SellerListingStatus;
  digital?: {
    fileReference: string;
    maxDownloads: number;
  };
  physical?: {
    stock: number;
    weightGrams: number;
  };
  service?: {
    serviceType: string;
    estimatedHours: number;
    instructions: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SellerListing {
  id: string;
  status: SellerListingStatus;
  product: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    category: string | null;
    kind: ProductKind;
    type: ProductType;
    status: ProductStatus;
    image: ProductImage | null;
    canEdit: boolean;
    createdAt: string;
    updatedAt: string;
  };
  offers: SellerProductOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerListingsPage {
  items: SellerListing[];
  nextCursor: string | null;
}

export type BlogLocale = "fa" | "en" | "ar";
export type BlogWorkflowState =
  | "draft"
  | "pending_review"
  | "published"
  | "rejected";

export interface RichTextDocument {
  type: "doc";
  content?: RichTextNode[];
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
  text?: string;
}

export interface BlogTranslationDraft {
  locale: BlogLocale;
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  coverAltText: string;
  content: RichTextDocument;
}

export interface BlogMediaVariant {
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface BlogMediaAsset {
  id: string;
  kind: "cover" | "inline";
  width: number;
  height: number;
  variants: BlogMediaVariant[];
}

export interface BlogTaxonomyTranslation {
  locale: BlogLocale;
  name: string;
  slug: string;
}

export interface BlogTaxonomyTerm {
  id: string;
  translations: BlogTaxonomyTranslation[];
}

export interface RelatedProductSummary {
  id: string;
  title: string;
  slug: string;
  startingPrices: ProductStartingPrice[];
}

export interface ManagedBlogPost {
  id: string;
  state: BlogWorkflowState;
  archivedAt: string | null;
  seller: { id: string; shopName: string } | null;
  revision: number;
  optimisticVersion: number;
  translations: BlogTranslationDraft[];
  publicSlugs: Partial<Record<BlogLocale, string>>;
  cover: BlogMediaAsset | null;
  category: BlogTaxonomyTerm | null;
  tags: BlogTaxonomyTerm[];
  relatedProducts: RelatedProductSummary[];
  moderationNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export type BlogPostStatus = BlogWorkflowState | "archived";

export interface BlogPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: BlogPostStatus;
  locale?: BlogLocale;
  cover?: BlogMediaAsset | null;
  author?: { id: string | null; name: string; type: "editorial" | "seller" };
  category?: { id: string; name: string; slug: string } | null;
  tags?: Array<{ id: string; name: string; slug: string }>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBlogPost extends BlogPostSummary {
  content: RichTextDocument;
  seoTitle: string;
  seoDescription: string;
  coverAltText: string;
  author: { id: string | null; name: string; type: "editorial" | "seller" };
  relatedProducts: RelatedProductSummary[];
  alternateSlugs: Record<BlogLocale, string>;
}

export interface SellerBlogPost extends BlogPostSummary {
  content: string;
}

export interface BlogPostsPage {
  items: BlogPostSummary[];
  nextCursor: string | null;
}

export interface PublicBlogCollection {
  id: string;
  kind: "category" | "tag" | "seller";
  name: string;
  alternateSlugs: Record<BlogLocale, string>;
}

export interface BlogCollectionPage extends BlogPostsPage {
  collection: PublicBlogCollection;
}

export type CouponDiscountType = "percentage" | "fixed";

export interface SellerCoupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  currency: string;
  minimumOrderAmount: string | null;
  maximumRedemptions: number | null;
  redeemedCount: number;
  startsAt: string;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerCouponsPage {
  items: SellerCoupon[];
  nextCursor: string | null;
}

export interface AdminSellerCoupon extends SellerCoupon {
  seller: {
    id: string;
    shopName: string;
  };
}

export interface AdminSellerCouponsPage {
  items: AdminSellerCoupon[];
  nextCursor: string | null;
}

export interface AdminProductSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  kind: ProductKind;
  type: ProductType;
  status: ProductStatus;
  image: ProductImage | null;
  listingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsPage {
  items: AdminProductSummary[];
  nextCursor: string | null;
}

export interface AdminProductDetails extends AdminProductSummary {
  createdBy: { id: string; shopName: string };
  options: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; value: string }>;
  }>;
  variants: Array<{
    id: string;
    name: string | null;
    options: ProductOptionSelection[];
  }>;
  listings: Array<{
    id: string;
    status: SellerListingStatus;
    seller: { id: string; shopName: string };
    offers: SellerProductOffer[];
    createdAt: string;
    updatedAt: string;
  }>;
  nextListingCursor: string | null;
}

export type ContentChangeAction = "create" | "update" | "review" | "restore";

export interface ProductChangeSnapshot {
  title: string;
  slug?: string;
  description: string | null;
  category: string | null;
  status: ProductStatus;
}

export interface ContentChangeActor {
  id: string;
  name: string;
  role: Role;
}

export interface ProductChangeEvent {
  id: string;
  action: ContentChangeAction;
  changedFields: string[];
  before: ProductChangeSnapshot | null;
  after: ProductChangeSnapshot;
  restoredFromChangeId: string | null;
  bulkOperationId: string | null;
  actor: ContentChangeActor;
  product: {
    id: string;
    title: string;
    slug: string;
    type: ProductType;
    seller: { id: string; shopName: string };
  };
  createdAt: string;
}

export interface ProductChangesPage {
  items: ProductChangeEvent[];
  nextCursor: string | null;
}

export interface ProductBulkUndoPreview {
  changeIds: string[];
  changeCount: number;
  affectedProductCount: number;
  hasMore: boolean;
}

export interface ProductBulkUndoResult {
  operationId: string;
  undoneCount: number;
  affectedProductCount: number;
  replayed: boolean;
}

export interface BlogChangeSnapshot {
  translations: BlogTranslationDraft[];
  coverAssetId: string | null;
  categoryId: string | null;
  tagIds: string[];
  relatedProductIds: string[];
}

export interface BlogChangeEvent {
  id: string;
  action: ContentChangeAction;
  changedFields: string[];
  before: BlogChangeSnapshot | null;
  after: BlogChangeSnapshot;
  restoredFromChangeId: string | null;
  actor: ContentChangeActor;
  createdAt: string;
}

export interface BlogChangesPage {
  items: BlogChangeEvent[];
  nextCursor: string | null;
}

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  orderCount: number;
  createdAt: string;
}

export interface AdminUsersPage {
  items: AdminUserSummary[];
  nextCursor: string | null;
}

export interface AdminSmsSettings {
  otpEnabled: boolean;
  provider: "sms_ir";
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  credentialSource: "database" | "environment" | "none";
  templateIds: {
    otp: number | null;
    sellerNewOrder: number | null;
    buyerSuccess: number | null;
    buyerFailure: number | null;
  };
  updatedAt: string | null;
}

export interface AuthLoginMethods {
  emailPasswordEnabled: boolean;
  phoneOtpEnabled: boolean;
}

export interface AdminAuthLoginSettings extends AuthLoginMethods {
  updatedAt: string | null;
}

export interface AdminShippingSettings {
  enabled: boolean;
  provider: "amadast";
  clientCodeConfigured: boolean;
  clientCodeHint: string | null;
  credentialSource: "database" | "environment" | "none";
  userId: number | null;
  storeId: number | null;
  productType: number;
  packageType: number;
  updatedAt: string | null;
}

export interface SellerShippingProfile {
  sellerId: string;
  granted: boolean;
  enabled: boolean;
  complete: boolean;
  senderName: string | null;
  senderMobile: string | null;
  province: string | null;
  city: string | null;
  addressLine: string | null;
  postalCode: string | null;
  updatedAt: string | null;
}

export interface AdminSellerShippingProfile extends SellerShippingProfile {
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  sellerStatus: "invited" | "active" | "suspended";
}

export interface AdminSellerShippingProfilesPage {
  items: AdminSellerShippingProfile[];
  nextCursor: string | null;
}

export type UsdRateProviderId = "alanchand" | "nobitex" | "tgju";

export interface AdminUsdRateProviderQuote {
  id: UsdRateProviderId;
  name: string;
  sourceUrl: string;
  rateToman: string | null;
  status: "available" | "unavailable";
  errorCode: string | null;
}

export interface AdminUsdRateSettings {
  automationEnabled: boolean;
  selectedProvider: UsdRateProviderId;
  providers: AdminUsdRateProviderQuote[];
  currentRateToman: string | null;
  currentRateIrr: string | null;
  rateSource: UsdRateProviderId | "manual" | null;
  rateUpdatedAt: string | null;
  cronStatus: "never" | "running" | "success" | "failed" | "cancelled";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
  nextRunAt: string | null;
  updatedAt: string;
  sourceUrl: string;
  intervalHours: number;
}

export type PaymentTransactionStatus =
  | "created"
  | "initiating"
  | "initiation_unknown"
  | "pending"
  | "succeeded"
  | "refund_pending"
  | "refund_unknown"
  | "failed"
  | "refunded";

export type PaymentProviderUnavailabilityReason =
  | "development_only"
  | "missing_merchant_id"
  | "missing_callback_url";

export interface AdminPaymentMethod {
  code: string;
  name: string;
  adapterAvailable: boolean;
  unavailabilityReason: PaymentProviderUnavailabilityReason | null;
  enabled: boolean;
  currencies: string[];
  supportsRefunds: boolean;
  configuration: {
    merchantIdConfigured: boolean;
    merchantIdHint: string | null;
    callbackUrlConfigured: boolean;
    refundAccessTokenConfigured: boolean;
    refundAccessTokenHint: string | null;
  } | null;
  allowedProductTypes: ProductType[];
  allowedSellers: AdminPaymentSellerOption[];
}

export interface AdminPaymentSellerOption {
  id: string;
  shopName: string;
}

export interface AdminPaymentTransaction {
  id: string;
  orderId: string;
  provider: string;
  status: PaymentTransactionStatus;
  amount: string;
  currency: string;
  authority: string | null;
  providerReferenceId: string | null;
  failureCode: string | null;
  buyer: {
    id: string;
    fullName: string;
    email: string;
  };
  seller: {
    id: string;
    shopName: string;
  };
  verifiedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPaymentTransactionsPage {
  items: AdminPaymentTransaction[];
  nextCursor: string | null;
  total: number;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "awaiting_confirmation"
  | "delivered"
  | "cancelled";

export interface CheckoutCartLine {
  offerId: string;
  quantity: number;
  serviceNote?: string;
}

export interface CheckoutPaymentMethod {
  code: string;
  name: string;
}

export interface CheckoutQuoteGroup {
  key: string;
  seller: { id: string; shopName: string };
  productType: Exclude<ProductType, "bridge">;
  items: Array<{
    offerId: string;
    productId: string;
    title: string;
    image: { url: string; width: number; height: number } | null;
    productType: Exclude<ProductType, "bridge">;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
    availableStock: number | null;
    serviceNote: string | null;
  }>;
  totalAmount: string;
  paymentMethods: CheckoutPaymentMethod[];
}

export interface CheckoutQuote {
  currency: "IRR";
  totalAmount: string;
  groups: CheckoutQuoteGroup[];
  commonPaymentMethods: CheckoutPaymentMethod[];
  requiresShippingAddress: boolean;
}

export interface CheckoutDetail {
  id: string;
  status: "pending_payment" | "partially_paid" | "paid" | "expired" | "cancelled";
  currency: "IRR";
  totalAmount: string;
  expiresAt: string;
  createdAt: string;
  orders: Array<{
    id: string;
    status: OrderStatus;
    seller: { id: string; shopName: string };
    totalAmount: string;
    items: Array<{
      id: string;
      offerId: string;
      productType: ProductType;
      productTitle: string;
      quantity: number;
      unitPrice: string;
      totalAmount: string;
      serviceNote: string | null;
      digitalDelivery: null | { downloadUrl: string; destinationHost: string; maxDownloads: number; downloadCount: number };
    }>;
  }>;
  paymentGroups: Array<{
    id: string;
    provider: string;
    status: "pending" | "paid" | "failed" | "expired";
    amount: string;
    currency: "IRR";
    orderIds: string[];
    expiresAt: string;
    latestAttempt: null | { status: PaymentTransactionStatus; authority: string | null; failure_code: string | null };
  }>;
}

export type PayoutStatus =
  | "draft"
  | "requested"
  | "approved"
  | "settled"
  | "disputed";

export type Role =
  | "platform-admin"
  | "platform-staff"
  | "seller-admin"
  | "seller-staff"
  | "buyer";

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  permissions?: VendorPermission[];
  isPlatformOwner?: boolean;
  platformPermissions?: PlatformPermission[];
}

export type PlatformPermission =
  | "vendors_manage"
  | "catalog_view"
  | "orders_manage"
  | "payouts_manage"
  | "blog_manage";

export type VendorPermission =
  | "products_manage"
  | "physical_products_manage"
  | "products_publish"
  | "blog_manage"
  | "coupons_manage"
  | "orders_manage"
  | "staff_manage"
  | "analytics_view"
  | "payouts_request";

export type AnalyticsScope = "admin" | "seller";
export type AnalyticsGranularity = "hour" | "day" | "week" | "month";

export interface AnalyticsMetric {
  value: string;
  previousValue: string;
  changePercent: number | null;
}

export interface AnalyticsSeriesPoint {
  bucket: string;
  grossSales: string;
  income: string;
  refunds: string;
  netSales: string;
  paidOrders: number;
}

export interface AnalyticsBreakdownItem {
  key: string;
  label: string;
  count: number;
  amount: string;
}

export interface AnalyticsRankingItem {
  id: string;
  label: string;
  secondaryLabel: string | null;
  count: number;
  units: number;
  amount: string;
}

export interface AnalyticsActivityItem {
  id: string;
  kind: "sale" | "refund" | "payout";
  label: string;
  secondaryLabel: string | null;
  amount: string;
  occurredAt: string;
  status: string;
}

export interface AnalyticsOverview {
  scope: AnalyticsScope;
  currency: "IRR";
  range: {
    from: string;
    to: string;
    timezone: "Asia/Tehran";
    granularity: AnalyticsGranularity;
    previousFrom: string;
    previousTo: string;
  };
  summary: {
    grossSales: AnalyticsMetric;
    netSales: AnalyticsMetric;
    income: AnalyticsMetric;
    paidOrders: AnalyticsMetric;
    unitsSold: AnalyticsMetric;
    averageOrderValue: AnalyticsMetric;
    refunds: AnalyticsMetric;
    commission: AnalyticsMetric;
    holdback: AnalyticsMetric;
    settledPayouts: AnalyticsMetric;
    outstandingLiability: string;
  };
  series: AnalyticsSeriesPoint[];
  orderStatuses: AnalyticsBreakdownItem[];
  productTypes: AnalyticsBreakdownItem[];
  payoutPipeline: AnalyticsBreakdownItem[];
  topProducts: AnalyticsRankingItem[];
  topCategories: AnalyticsRankingItem[];
  topSellers?: AnalyticsRankingItem[];
  recentActivity: AnalyticsActivityItem[];
  generatedAt: string;
}

export type BridgeProvider = "dhru_legacy" | "dhru_new" | "webx";
export type BridgeConnectionStatus = "active" | "inactive" | "error";
export type BridgeServiceKind = "imei" | "server" | "file";
export type BridgeGrantStatus = "active" | "revoked";
export type BridgeFulfillmentMode = "automatic" | "manual";

export interface BridgeFieldDefinition {
  key: string;
  type: "text" | "textarea" | "number" | "select";
  required: boolean;
  label: string;
  placeholder?: string;
  helpText?: string;
  minimumLength?: number;
  maximumLength?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface PublicBridgeProduct {
  fields: BridgeFieldDefinition[];
  minimumQuantity: number;
  maximumQuantity: number;
}

export interface BridgeConnectionSummary {
  id: string;
  name: string;
  provider: BridgeProvider;
  baseUrl: string;
  status: BridgeConnectionStatus;
  usernameHint: string;
  hasApiKey: boolean;
  lastTestedAt: string | null;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
}

export interface BridgeServiceSummary {
  id: string;
  connectionId: string;
  externalServiceId: string;
  name: string;
  groupName: string | null;
  kind: BridgeServiceKind;
  available: boolean;
  fields: BridgeFieldDefinition[];
  schemaHash: string;
}

export interface BridgeGrantSummary {
  id: string;
  status: BridgeGrantStatus;
  service: BridgeServiceSummary;
  linkedProductCount: number;
  grantedAt: string;
  revokedAt: string | null;
}

export type VendorStatus = "invited" | "active" | "suspended";

export interface Vendor {
  id: string;
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phoneNumber: string | null;
  status: VendorStatus;
  commission: number;
  holdbackRate: number;
  blogReviewRequired: boolean;
  permissions: VendorPermission[];
  productCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CommentPostingPolicy = "purchasers" | "buyers" | "guests";
export type CommentPublicationPolicy = "approval" | "immediate";
export type CommentStatus = "pending" | "approved" | "rejected" | "spam_review" | "spam";

export interface CommentSettings {
  sellerLockEnabled: boolean;
  postingPolicy: CommentPostingPolicy;
  publicationPolicy: CommentPublicationPolicy;
  updatedAt: string | null;
}

export interface ProductComment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  replies: Array<{ sellerName: string; body: string; repliedAt: string }>;
}

export interface SellerComment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  productTitle: string;
  productSlug: string;
  reply: string | null;
  repliedAt: string | null;
}

export interface AdminComment {
  id: string;
  body: string;
  status: CommentStatus;
  authorName: string;
  createdAt: string;
  productTitle: string;
  productSlug: string;
  flagged: boolean;
  replies: Array<{ sellerName: string; body: string | null }>;
}

export interface CommentPage<T> { items: T[]; nextCursor: string | null }
