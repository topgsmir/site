export type { HomepageLocale, HomepageLink, HomepageCard, HomepageSection, HomepageContent, HomepageDocument } from "./homepage";
export type ProductType = "digital" | "physical" | "service" | "bridge";
export type ProductKind = "simple" | "variable";
export type ProductStatus = "draft" | "pending_review" | "active" | "archived";
export type SellerListingStatus = "draft" | "active" | "archived";

export interface HomepageStory {
  id: string;
  locale: "fa" | "en" | "ar";
  title: string;
  targetUrl: string;
  position: number;
  enabled: boolean;
  image: { url: string; width: number; height: number };
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptionSelection {
  name: string;
  value: string;
}

export interface ProductStartingPrice {
  currency: string;
  price: string;
}

export type ServiceInputType = "text" | "textarea" | "password";

export interface ServiceInputDefinition {
  key: string;
  label: string;
  type: ServiceInputType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  minimumLength?: number;
  maximumLength?: number;
}

export interface ServiceInputAnswer {
  key: string;
  label: string;
  type: ServiceInputType;
  value: string | null;
  sensitive: boolean;
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
  categoryId?: string | null;
  availableLocales?: Array<"fa" | "en" | "ar">;
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
  service?: { serviceType: string; estimatedHours: number; inputs: ServiceInputDefinition[] };
}

export interface PublicProductVariant {
  id: string;
  name: string | null;
  options: ProductOptionSelection[];
  offers: PublicSellerOffer[];
}

export interface PublicProduct {
  categoryId?: string | null;
  availableLocales?: Array<"fa" | "en" | "ar">;
  contentLocale?: "fa" | "en" | "ar";
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
    fileReferences: string[];
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
    inputs: ServiceInputDefinition[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface SellerListing {
  id: string;
  status: SellerListingStatus;
  product: {
    categoryId?: string | null;
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
  image?: ProductImage | null;
}

export interface BlogSidebarContent {
  enabled: boolean;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface BlogSidebarDocument {
  locale: BlogLocale;
  version: number;
  content: BlogSidebarContent | null;
  products: RelatedProductSummary[];
  updatedAt: string | null;
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
  categoryId?: string | null;
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
  username: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersPage {
  items: AdminUserSummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUserHistoryPage {
  items: { id: string; at: string | null; title: string; details: Record<string, string | number | boolean | null> }[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminSmsSettings {
  otpEnabled: boolean;
  testModeEnabled: boolean;
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

export interface GoghdiPublicConfig {
  enabled: boolean;
  sdkUrl: string | null;
  tenantId: string | null;
  apiUrl: string | null;
  socketUrl: string | null;
  widgetUrl: string | null;
}

export interface AdminGoghdiSettings extends GoghdiPublicConfig {
  tenantSecretConfigured: boolean;
  tenantSecretHint: string | null;
  credentialSource: "database" | "environment" | "none";
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
  provider: string;
  providerName: string;
  apiKeyConfigured: boolean;
  apiKeyHint: string | null;
  credentialSource: "database" | "environment" | "none";
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
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
}

export interface ShippingPlaceOption {
  id: number;
  title: string;
  parentId: number | null;
}

export interface SellerPublicProfileSettings {
  sellerId: string;
  shopName: string;
  publicName: string | null;
  specialty: string | null;
  bio: string | null;
  profilePicture: SellerProfilePicture | null;
  updatedAt: string;
}

export interface SellerProfilePicture {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface PublicExpertSummary {
  id: string;
  name: string;
  specialty: string | null;
  profilePicture: SellerProfilePicture | null;
  activeProductCount: number;
}

export interface PublicExpertProfile extends PublicExpertSummary {
  bio: string | null;
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
    email: string | null;
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
    serviceInputs: ServiceInputDefinition[];
  }>;
  totalAmount: string;
  paymentMethods: CheckoutPaymentMethod[];
}

export interface CheckoutQuote {
  currency: "TOMAN";
  totalAmount: string;
  groups: CheckoutQuoteGroup[];
  commonPaymentMethods: CheckoutPaymentMethod[];
  requiresShippingAddress: boolean;
}

export interface CheckoutDetail {
  id: string;
  status: "pending_payment" | "partially_paid" | "paid" | "expired" | "cancelled";
  currency: "TOMAN";
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
      digitalDeliveries: Array<{ downloadUrl: string; destinationHost: string; maxDownloads: number; downloadCount: number }>;
      digitalDelivery: null | { downloadUrl: string; destinationHost: string; maxDownloads: number; downloadCount: number };
    }>;
  }>;
  paymentGroups: Array<{
    id: string;
    provider: string;
    status: "pending" | "paid" | "failed" | "expired";
    amount: string;
    currency: "TOMAN";
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
  sellerId?: string;
  fullName: string;
  username?: string | null;
  email: string | null;
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
  | "blog_manage"
  | "uploads_manage";

export type AdminUploadSource = "blog" | "product";
export type AdminUploadState = "active" | "trashed" | "purging";
export type AdminUploadLinkState = "linked" | "unlinked";

export interface AdminUploadSummary {
  assetCount: number;
  generatedStorageBytes: number;
  unlinkedCount: number;
  trashCount: number;
  upcomingPurgeCount: number;
}

export interface AdminUploadListItem {
  source: AdminUploadSource;
  id: string;
  kind: string;
  state: AdminUploadState;
  linkState: AdminUploadLinkState;
  originalFilename: string | null;
  originalMimeType: string | null;
  width: number;
  height: number;
  sourceBytes: number;
  generatedBytes: number;
  checksum: string;
  createdAt: string;
  trashedAt: string | null;
  purgeAfter: string | null;
  previewUrl: string | null;
  owner: { id: string; name: string; email: string | null };
  linkedContent: { id: string; title: string; type: "post" | "product" } | null;
}

export interface AdminUploadPage {
  items: AdminUploadListItem[];
  nextCursor: string | null;
}

export interface AdminUploadEvent {
  id: string;
  action: "trashed" | "auto_trashed" | "restored" | "purged" | "purge_failed";
  reason: string | null;
  actor: { id: string; name: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUploadDetail extends AdminUploadListItem {
  variants: Array<{ name: string; width: number; height: number; bytes: number; url: string }>;
  seller: { id: string; shopName: string } | null;
  references: Array<{ id: string; title: string; usage: string }>;
  restoration: { eligible: boolean; reason: "active" | "product_missing" | "replacement_exists" | "purge_started" | null };
  events: AdminUploadEvent[];
}

export interface AdminUploadBulkResult {
  results: Array<{
    source: AdminUploadSource;
    id: string;
    ok: boolean;
    status: number;
    code: string;
    message: string;
    purgeAfter?: string;
  }>;
}

export type BackupFrequency = "disabled" | "daily" | "weekly";
export type BackupComponent = "database" | "uploads";
export type BackupProtocol = "sftp" | "ftps" | "ftp";
export type BackupRunStatus = "queued" | "running" | "success" | "partial" | "failed";
export type BackupDeliveryStatus = "pending" | "uploading" | "success" | "failed";
export type BackupRestoreStatus = "staged" | "ready" | "pending_restart" | "restoring" | "success" | "failed" | "recovery_required";

export interface AdminBackupSettings {
  automationEnabled: boolean;
  frequency: BackupFrequency;
  weekdays: number[];
  localTime: string;
  timezone: string;
  includeDatabase: boolean;
  includeUploads: boolean;
  localRetentionCount: number;
  nextRunAt: string | null;
  lastRunStatus: BackupRunStatus | "never";
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  updatedAt: string | null;
}

export interface AdminBackupDestination {
  id: string;
  name: string;
  protocol: BackupProtocol;
  host: string;
  port: number;
  username: string;
  remotePath: string;
  retentionCount: number;
  enabled: boolean;
  verifiedAt: string | null;
  lastTestStatus: "never" | "success" | "failed";
  lastErrorCode: string | null;
  credentialConfigured: boolean;
  privateKeyConfigured: boolean;
  hostKeyFingerprint: string | null;
  allowInsecure: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBackupDelivery {
  id: string;
  destinationId: string;
  destinationName: string;
  protocol: BackupProtocol;
  status: BackupDeliveryStatus;
  remotePath: string | null;
  attempts: number;
  errorCode: string | null;
  completedAt: string | null;
}

export interface BackupManifestSummary {
  formatVersion: 1;
  archiveId: string;
  createdAt: string;
  appVersion: string;
  migrationId: string | null;
  postgresMajor: number;
  components: BackupComponent[];
  databaseBytes: number;
  uploadsBytes: number;
  uploadCount: number;
  platformOwnerCount: number;
}

export interface AdminBackupRun {
  id: string;
  trigger: "manual" | "scheduled" | "pre_restore";
  status: BackupRunStatus;
  components: BackupComponent[];
  archiveName: string | null;
  archiveBytes: number | null;
  archiveSha256: string | null;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  actor: { id: string; name: string } | null;
  deliveries: AdminBackupDelivery[];
}

export interface AdminBackupRunPage {
  items: AdminBackupRun[];
  nextCursor: string | null;
}

export interface AdminBackupOverview {
  settings: AdminBackupSettings;
  destinations: AdminBackupDestination[];
  recentRuns: AdminBackupRun[];
  recentRestores: AdminBackupRestoreEvent[];
  localArchiveBytes: number;
  activeRunId: string | null;
}

export interface AdminBackupRestoreEvent {
  id: string;
  archiveId: string | null;
  status: BackupRestoreStatus;
  phase: BackupRestoreProgress["phase"];
  errorCode: string | null;
  createdAt: string;
}

export interface AdminRemoteBackupArchive {
  destinationId: string;
  destinationName: string;
  protocol: BackupProtocol;
  name: string;
  bytes: number | null;
  modifiedAt: string | null;
}

export interface BackupRestorePreflight {
  challengeId: string;
  confirmationPhrase: string;
  expiresAt: string;
  manifest: BackupManifestSummary;
  safetyBackupRequired: true;
}

export interface BackupRestoreProgress {
  id: string;
  status: BackupRestoreStatus;
  phase: "validating" | "safety_backup" | "database" | "migrations" | "uploads" | "sessions" | "complete" | "rollback";
  message: string;
  updatedAt: string;
}

export interface PublicSystemStatus {
  maintenance: boolean;
  reason: "restore" | null;
  restoreId: string | null;
  updatedAt: string | null;
}

export type VendorPermission =
  | "blog_ai"
  | "products_ai"
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
  currency: "TOMAN";
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
  goghdiAgentId: string | null;
  permissions: VendorPermission[];
  productCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export type CommentPostingPolicy = "purchasers" | "buyers" | "guests";
export type CommentPublicationPolicy = "approval" | "immediate";
export type CommentStatus = "pending" | "approved" | "rejected" | "spam_review" | "spam";
export type CommentTargetType = "product" | "blog";

export interface CommentTarget {
  type: CommentTargetType;
  id: string;
  title: string;
  slug: string;
}

export interface CommentReply {
  authorName: string;
  authorType: "seller" | "editorial";
  sellerName?: string;
  body: string;
  repliedAt: string;
}

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
  replies: CommentReply[];
}

export type BlogComment = ProductComment;

export interface SellerComment {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
  target: CommentTarget;
  productTitle: string | null;
  productSlug: string | null;
  reply: string | null;
  repliedAt: string | null;
}

export interface AdminComment {
  id: string;
  body: string;
  status: CommentStatus;
  authorName: string;
  createdAt: string;
  target: CommentTarget;
  productTitle: string | null;
  productSlug: string | null;
  flagged: boolean;
  canReply: boolean;
  canFlag: boolean;
  replies: Array<{ authorName: string; authorType: "seller" | "editorial"; sellerName?: string; body: string | null }>;
}

export interface CommentPage<T> { items: T[]; nextCursor: string | null }

export interface PublicProductsPage {
  items: PublicProductSummary[];
  nextCursor: string | null;
}

export interface ProductTranslation {
  locale: "en" | "ar";
  draft: { title: string; description: string; category: string | null };
  published: { title: string; description: string; category: string | null; publishedAt: string } | null;
  updatedAt: string;
}

export interface ContentAiDraft {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  coverAltText: string;
  category: string;
  tags: string[];
  warnings: string[];
  content: RichTextDocument;
  description: string;
  html: string;
}

export interface ContentAiRequest {
  locale: BlogLocale;
  source: string;
  keyword?: string;
  audience?: string;
  coverDescription?: string;
  categories?: string[];
  tags?: string[];
}

export interface ContentAiResult {
  locale: BlogLocale;
  status: "ready";
  draft: ContentAiDraft;
}
