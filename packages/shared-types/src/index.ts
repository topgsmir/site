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

export interface PublicProductSummary {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  kind: ProductKind;
  type: ProductType;
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

export interface AdminProductSummary {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  kind: ProductKind;
  type: ProductType;
  status: ProductStatus;
  listingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsPage {
  items: AdminProductSummary[];
  nextCursor: string | null;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "awaiting_confirmation"
  | "delivered"
  | "cancelled";

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
  | "products_publish"
  | "blog_manage"
  | "coupons_manage"
  | "orders_manage"
  | "staff_manage"
  | "analytics_view"
  | "payouts_request";

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
