import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export type AdminToolRisk = "read" | "write" | "destructive" | "critical";
export type AdminToolMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AdminToolJson = null | boolean | number | string | AdminToolJson[] | { [key: string]: AdminToolJson };
export type AdminToolInput = {
  workspace?: "seller";
  path?: Record<string, string>;
  query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  body?: AdminToolJson;
};

export type AdminToolDefinition = {
  name: string;
  domain: string;
  method: AdminToolMethod;
  path: string;
  risk: AdminToolRisk;
  description: string;
  inputHint: string;
  idempotent?: boolean;
  responseMode?: "json" | "download";
};

export type PreparedAdminTool = {
  workspace?: "seller";
  name: string;
  domain: string;
  method: AdminToolMethod;
  path: string;
  query: NonNullable<AdminToolInput["query"]>;
  body?: AdminToolJson;
  risk: AdminToolRisk;
  description: string;
  idempotencyKey?: string;
  responseMode: "json" | "download";
};

const tool = (
  name: string,
  domain: string,
  method: AdminToolMethod,
  path: string,
  risk: AdminToolRisk,
  description: string,
  inputHint = "No input.",
  idempotent = false,
  responseMode: "json" | "download" = "json"
): AdminToolDefinition => ({ name, domain, method, path, risk, description, inputHint, ...(idempotent ? { idempotent: true } : {}), ...(responseMode === "download" ? { responseMode } : {}) });

// Match common Persian and Arabic admin terms before asking the model to discover
// English-only catalog names. These aliases affect ranking only, never authority.
const SEARCH_ALIASES: ReadonlyArray<{ pattern: RegExp; terms: readonly string[] }> = [
  { pattern: /محصول|کالا|منتج|سلعة/u, terms: ["product", "catalog"] },
  { pattern: /عنوان|تیتر|اسم/u, terms: ["title", "translation"] },
  { pattern: /ترجم|زبان|لغة/u, terms: ["translation", "locale"] },
  { pattern: /سفارش|طلب/u, terms: ["order"] },
  { pattern: /ارسال|حمل|شحن/u, terms: ["shipping", "shipment"] },
  { pattern: /فروشنده|بائع/u, terms: ["seller"] },
  { pattern: /کاربر|مستخدم/u, terms: ["user"] },
  { pattern: /موجودی|مخزون/u, terms: ["stock", "inventory"] },
  { pattern: /قیمت|هزینه|سعر/u, terms: ["price", "pricing"] },
  { pattern: /پرداخت|دفع/u, terms: ["payment"] },
  { pattern: /بازگشت وجه|استرداد/u, terms: ["refund"] },
  { pattern: /فهرست|لیست|نمایش|اعرض|قائمة/u, terms: ["list", "search"] },
  { pattern: /جستجو|جست‌وجو|بحث/u, terms: ["search"] },
  { pattern: /ویرایش|تغییر|بروزرسانی|به‌روزرسانی|تعدیل|تحدیث/u, terms: ["update"] },
  { pattern: /ایجاد|ساخت|ثبت|إنشاء|إضافة|اضافة/u, terms: ["create", "register"] },
  { pattern: /تأیید|تایید|تصویب|موافقة/u, terms: ["approve", "review"] },
  { pattern: /حذف|پاک|إزالة/u, terms: ["delete", "remove"] },
  { pattern: /کوپن|قسیمة|قسيمة/u, terms: ["coupon"] },
  { pattern: /وبلاگ|مقاله|مدونة/u, terms: ["blog"] },
  { pattern: /سئو|تحسين محركات/u, terms: ["seo"] }
];

/**
 * API operations exposed to the owner-only admin assistant. Local file inputs and
 * downloads are browser-mediated; login/logout session flows, one-time restore
 * monitors, CAPTCHA/OTP flows, and provider callbacks stay in their
 * dedicated user flows.
 */
export const ADMIN_TOOL_CATALOG: readonly AdminToolDefinition[] = [
  tool("admin_own_shop_create", "sellers", "POST", "/seller/own-shop", "write", "Create the current platform owner's shop without changing their admin role. Repeated setup preserves the existing shop and permissions. New shops have zero platform commission. Use workspace=seller on subsequent seller API tools.", "body: shopName 2..120 characters. No user ID, seller ID, role or permissions accepted."),
  tool("club_me", "club", "GET", "/club/me", "read", "Read the current actor's personal club balance and tier."),
  tool("club_history", "club", "GET", "/club/me/history", "read", "Read the current actor's point history.", "query: cursor UUID, limit 1..100."),
  tool("club_rewards", "club", "GET", "/club/rewards", "read", "List currently active club rewards."),
  tool("club_wallet_redeem", "club", "POST", "/club/me/wallet-redemptions", "critical", "Convert points to expiring promotional wallet credit.", "body: rewardId UUID; Idempotency-Key UUID.", true),
  tool("admin_club_settings", "club", "GET", "/admin/club/settings", "read", "Read club activation and earning rules."),
  tool("admin_club_settings_update", "club", "PATCH", "/admin/club/settings", "critical", "Update club activation and earning rules.", "body: enabled, earning and redemption rates, bonuses, limits and expiry days."),
  tool("admin_club_tiers", "club", "GET", "/admin/club/tiers", "read", "List club tiers."),
  tool("admin_club_tier_create", "club", "POST", "/admin/club/tiers", "write", "Create a club tier.", "body: localized names, thresholdToman, sortOrder, active."),
  tool("admin_club_tier_update", "club", "PUT", "/admin/club/tiers/:id", "write", "Update a club tier.", "path: tier UUID; body: complete tier definition."),
  tool("admin_club_rewards", "club", "GET", "/admin/club/rewards", "read", "List all club rewards."),
  tool("admin_club_reward_create", "club", "POST", "/admin/club/rewards", "write", "Create a wallet or discount reward.", "body: localized names, kind, point cost, value, limits and active."),
  tool("admin_club_reward_update", "club", "PUT", "/admin/club/rewards/:id", "write", "Update a club reward.", "path: reward UUID; body: complete reward definition."),
  tool("admin_club_campaigns", "club", "GET", "/admin/club/campaigns", "read", "List club bonus campaigns."),
  tool("admin_club_campaign_create", "club", "POST", "/admin/club/campaigns", "write", "Create a scheduled earning campaign.", "body: localized names, kind, value, dates, minimum tier and active."),
  tool("admin_club_campaign_update", "club", "PUT", "/admin/club/campaigns/:id", "write", "Update an earning campaign.", "path: campaign UUID; body: complete campaign definition."),
  tool("admin_club_members", "club", "GET", "/admin/club/members", "read", "List buyer club members.", "query: cursor UUID, limit 1..100."),
  tool("admin_club_member", "club", "GET", "/admin/club/members/:id", "read", "Read a member's balance and tier.", "path: buyer UUID."),
  tool("admin_club_member_history", "club", "GET", "/admin/club/members/:id/history", "read", "Read a member's point history.", "path: buyer UUID; query: cursor UUID, limit 1..100."),
  tool("admin_club_member_adjust", "club", "POST", "/admin/club/members/:id/adjustments", "critical", "Adjust member points with an audit reason.", "path: buyer UUID; body: signed points and reason; Idempotency-Key UUID.", true),
  tool("admin_club_member_override", "club", "POST", "/admin/club/members/:id/tier-overrides", "critical", "Grant a temporary member tier override.", "path: buyer UUID; body: tierId UUID, until ISO timestamp, reason."),
  tool("admin_club_reports", "club", "GET", "/admin/club/reports", "read", "Read club issue, redemption and membership totals."),
  tool("wallet_balance", "wallet", "GET", "/wallet", "read", "Read the current actor's personal wallet balance in TOMAN."),
  tool("wallet_transactions", "wallet", "GET", "/wallet/transactions", "read", "Read the current actor's paginated personal wallet ledger.", "query: cursor UUID and limit 1..50."),
  tool("wallet_topup_methods", "wallet", "GET", "/wallet/topup-methods", "read", "List payment providers for a personal wallet top-up."),
  tool("wallet_topup_create", "wallet", "POST", "/wallet/topups", "critical", "Initiate a personal wallet top-up for the current actor; credit occurs only after provider verification.", "body: amount 1000..100000000 TOMAN as integer string; provider zarinpal or zibal; Idempotency-Key UUID.", true),
  tool("wallet_topup_get", "wallet", "GET", "/wallet/topups/:id", "read", "Read the current actor's personal wallet top-up state.", "path: top-up UUID."),
  tool("admin_wallet_balance", "wallet", "GET", "/wallet/admin/users/:userId", "read", "Read a buyer wallet balance.", "path: buyer user UUID."),
  tool("admin_wallet_transactions", "wallet", "GET", "/wallet/admin/users/:userId/transactions", "read", "Read a buyer's paginated wallet ledger with references and actors.", "path: buyer user UUID; query: cursor UUID and limit 1..50."),
  tool("admin_wallet_adjust", "wallet", "POST", "/wallet/admin/users/:userId/adjustments", "critical", "Credit or debit a buyer wallet with a durable reason, reference and administrator identity.", "path: buyer user UUID; body: signed integer TOMAN amount up to 10000000, reason 10..500 characters, reference 3..128 characters; Idempotency-Key UUID.", true),
  tool("admin_wallet_order_refund", "wallet", "POST", "/wallet/admin/users/:userId/orders/:orderId/refund", "critical", "Cancel an eligible paid order belonging to the selected buyer and refund its full amount to that wallet after owner approval.", "path: buyer user UUID and order UUID; body: reason 10..500 characters; Idempotency-Key UUID.", true),
  tool("seo_configuration_public", "seo", "GET", "/seo/configuration", "read", "Read public SEO defaults, page overrides and redirects. No audit identities are included."),
  tool("seo_settings_get", "seo", "GET", "/admin/seo", "read", "Read versioned SEO settings for all three languages."),
  tool("seo_history_get", "seo", "GET", "/admin/seo/history", "read", "Read the latest 20 SEO configuration revisions and actor IDs."),
  tool("seo_settings_update", "seo", "PATCH", "/admin/seo", "critical", "Replace SEO configuration after owner approval. Controls indexing, metadata, organization, verification and redirects; can affect search visibility. Restore history by saving its configuration with the current version.", "body: version (current integer), configuration: indexingEnabled boolean; locales (exactly fa/en/ar, each with siteName<=80, titleTemplate<=120 containing one %s, description<=320, socialImage HTTPS URL or empty); googleVerification and bingVerification (tokens<=200); organizationName<=120, organizationLogo HTTPS URL or empty, sameAs<=10 HTTPS URLs; pages<=100 {path, title<=120, description<=320, socialImage, noIndex, excludeFromSitemap}; redirects<=100 {source, destination, status:301|302, enabled}. Paths<=500, localized public paths only, no queries, duplicates, chains or loops."),
  tool("site_notice_get", "site", "GET", "/notice", "read", "Read the public platform notice."),
  tool("site_upload_centers_get", "site", "GET", "/upload-centers", "read", "Read the two configured upload center destinations."),
  tool("site_system_status", "site", "GET", "/system/status", "read", "Read public maintenance and restore status."),
  tool("site_login_methods", "security", "GET", "/auth/login-methods", "read", "Read the currently enabled login methods."),
  tool("site_security_policy", "security", "GET", "/auth/security-policy", "read", "Read the public CAPTCHA and login security policy."),
  tool("current_user_get", "users", "GET", "/auth/me", "read", "Read the current authenticated owner's safe account profile."),
  tool("current_user_update", "users", "PATCH", "/auth/me", "write", "Update allowlisted fields on the current authenticated owner's account.", "body: fullName, username and/or email."),
  tool("site_goghdi_config", "site", "GET", "/goghdi/config", "read", "Read the public, secret-free Goghdi chat configuration."),
  tool("site_homepage_get", "site", "GET", "/homepage", "read", "Read the localized homepage document.", "query: locale=fa|en|ar."),
  tool("site_homepage_image_download", "site", "GET", "/homepage/images/:id", "read", "Download a public homepage image to the owner's browser.", "path: id.", false, "download"),
  tool("site_media_download", "uploads", "GET", "/media/:assetId/:filename", "read", "Download an authorized media variant to the owner's browser.", "path: assetId and filename.", false, "download"),
  tool("site_stories_list", "site", "GET", "/stories", "read", "List enabled public homepage stories.", "query: locale=fa|en|ar."),
  tool("site_products_search", "catalog", "GET", "/products/page", "read", "Search and page through the public product catalog.", "query: locale, search, type, cursor, limit."),
  tool("site_products_list", "catalog", "GET", "/products", "read", "List the legacy bounded public product collection.", "query: supported locale and visibility filters."),
  tool("site_product_categories", "catalog", "GET", "/products/categories", "read", "List localized public product categories.", "query: locale."),
  tool("site_product_category_image", "catalog", "GET", "/products/categories/:categoryId/image", "read", "Read a category image.", "path: categoryId."),
  tool("site_product_sitemap", "catalog", "GET", "/products/sitemap", "read", "List public product sitemap entries."),
  tool("site_product_get", "catalog", "GET", "/products/:idOrSlug", "read", "Read one public product by UUID or slug.", "path: idOrSlug; query: locale."),
  tool("site_sellers_list", "sellers", "GET", "/seller/directory", "read", "List up to 50 approved, active specialist profiles, ordered by shop name and ID.", "No parameters."),
  tool("site_seller_get", "sellers", "GET", "/seller/directory/:id", "read", "Read one published specialist profile.", "path: id; query: locale."),
  tool("site_blog_posts", "blog", "GET", "/blog/public/:locale/posts", "read", "List published blog posts.", "path: locale; query: cursor, limit."),
  tool("site_blog_post_get", "blog", "GET", "/blog/public/:locale/posts/:slug", "read", "Read one published blog post.", "path: locale and slug."),
  tool("site_blog_category", "blog", "GET", "/blog/public/:locale/categories/:slug", "read", "List posts in a public blog category.", "path: locale and slug; query: cursor, limit."),
  tool("site_blog_tag", "blog", "GET", "/blog/public/:locale/tags/:slug", "read", "List posts with a public blog tag.", "path: locale and slug; query: cursor, limit."),
  tool("site_blog_seller", "blog", "GET", "/blog/public/:locale/sellers/:sellerId", "read", "List public posts from a seller.", "path: locale and sellerId; query: cursor, limit."),
  tool("site_blog_sitemap", "blog", "GET", "/blog/public/sitemap", "read", "List public blog sitemap entries."),
  tool("site_blog_sidebar", "blog", "GET", "/blog/sidebar", "read", "Read the localized blog sidebar promotion and its selected products.", "query: locale=fa|en|ar."),
  tool("site_comment_settings", "comments", "GET", "/comments/settings", "read", "Read the public comment posting policy."),
  tool("site_product_comments", "comments", "GET", "/comments/products/:productId", "read", "List approved comments for a product.", "path: productId; query: cursor, limit."),
  tool("site_blog_comments", "comments", "GET", "/comments/blog-posts/:postId", "read", "List approved comments for a blog post.", "path: postId; query: cursor, limit."),
  tool("site_product_comment_create", "comments", "POST", "/comments/products/:productId", "write", "Submit a product comment as the current authenticated actor.", "path: productId; body: body and optional guest fields when applicable."),
  tool("site_blog_comment_create", "comments", "POST", "/comments/blog-posts/:postId", "write", "Submit a blog comment as the current authenticated actor.", "path: postId; body: body and optional guest fields when applicable."),
  tool("site_checkout_quote", "checkout", "POST", "/checkouts/quote", "write", "Price and validate a prospective cart, including postal charges, parcel limits and an optional seller or all-sellers coupon, without creating an order.", "body: {items:[{offerId,quantity,serviceNote?}], shippingAddress?, couponCode?}; destination limits apply when the address is supplied."),
  tool("site_shipping_places", "checkout", "POST", "/checkouts/shipping-places", "write", "Look up allowed shipping places for the checkout selection.", "body: provider and parent place identifiers."),
  tool("site_checkout_create", "checkout", "POST", "/checkouts", "critical", "Create a checkout for the authenticated actor, checking the displayed total and reserving an optional coupon redemption.", "body: checkout items, address, payment selections, optional couponCode and expectedTotalAmount when shown to the buyer.", true),
  tool("site_checkout_get", "checkout", "GET", "/checkouts/:id", "read", "Read an authenticated checkout.", "path: id."),
  tool("site_checkout_pay", "checkout", "POST", "/checkouts/:id/payment-groups/:groupId/initiate", "critical", "Initiate payment for a checkout payment group.", "path: id and groupId.", true),
  tool("analytics_overview", "analytics", "GET", "/analytics/overview", "read", "Read the authenticated actor's analytics overview.", "query: supported analytics date filters."),

  tool("admin_users_list", "users", "GET", "/admin/users", "read", "Search and paginate platform users with each user's current wallet balance in TOMAN.", "query: role, status=all|active|blocked|deletion_pending|deleted, search<=100 by name, contact, UUID or five-character support code, page, limit<=50."),
  tool("admin_seller_statistics", "users", "GET", "/admin/users/seller-statistics", "read", "Read paginated seller listing, post, assigned-comment, completed-order income and current unsettled balance statistics.", "query: period=7d|month|3months|all (Tehran/Persian calendar), page 1..100000, limit 1..50."),
  tool("admin_user_access", "users", "GET", "/admin/users/:id/access", "read", "Read account status, global role, delegated permissions, seller membership, canonical ownership and latest deletion job.", "path: id=user UUID or 5-character support code."),
  tool("admin_user_account_events", "users", "GET", "/admin/users/:id/account-events", "read", "Read 25 audited account lifecycle events.", "path: id=user UUID or support code; query: cursor event UUID."),
  tool("admin_user_role_sellers", "users", "GET", "/admin/users/:id/role-sellers", "read", "Search non-merged sellers for an explicit role assignment.", "path: id=user UUID or support code; query: search<=100, cursor seller UUID; capped at 25."),
  tool("admin_user_replacements", "users", "GET", "/admin/users/:id/replacements", "read", "Search eligible active, non-platform replacement accounts with an unambiguous seller context.", "path: id=user UUID or support code; query: search<=100, cursor user UUID or support code; capped at 25."),
  tool("admin_user_deletion_impact", "users", "GET", "/admin/users/:id/deletion-impact", "read", "Preview ownership counts, commercial blockers, destination and merge conflicts before deletion.", "path: id=user UUID or support code; query: replacementUserId user UUID or support code, optional."),
  tool("admin_user_status", "users", "PATCH", "/admin/users/:id/status", "destructive", "Block or manually unblock an account. Blocking revokes all sessions but does not suspend its seller or hide content.", "path: id=user UUID or support code; body: status=active|blocked, reason 3..500."),
  tool("admin_user_role", "users", "PATCH", "/admin/users/:id/role", "critical", "Atomically change role, permissions and explicit seller membership, then revoke sessions. Canonical owners must retain their seller-admin role until ownership is transferred.", "path: id=user UUID or support code; body: role=buyer|seller_staff|seller_admin|platform_staff|platform_admin, reason 3..500, sellerId for seller roles; explicit permissions array for platform_staff only; currentPassword {$secureInput: owner password} and exact confirmation identifier for privileged transitions."),
  tool("admin_user_delete", "users", "POST", "/admin/users/:id/deletion-jobs", "critical", "Start irreversible anonymized deletion with durable ownership transfer. Review impact first. Completed financial and audit history never changes ownership; failed jobs require explicit retry.", "path: id=user UUID or support code; body: idempotencyKey UUID (reuse on transport retry), replacementUserId user UUID or support code when required, reason 3..500, currentPassword {$secureInput: owner password}, confirmation exact displayed identifier."),
  tool("admin_user_deletion_job", "users", "GET", "/admin/users/:id/deletion-jobs/:jobId", "read", "Read durable phase progress, transferred/archived/skipped/conflicted counts and safe failure code.", "path: id=user UUID or support code, jobId UUID."),
  tool("admin_user_deletion_retry", "users", "POST", "/admin/users/:id/deletion-jobs/:jobId/retry", "critical", "Explicitly retry a failed deletion from its committed phase and cursor. Never rolls a merge back.", "path: id=user UUID or support code, jobId UUID."),
  tool("admin_user_create", "users", "POST", "/admin/users", "critical", "Create a buyer account with an initial password and audit the administrator.", "body: fullName, email, optional username and phoneNumber, password {$secureInput: initial password}."),
  tool("admin_user_get", "users", "GET", "/admin/users/:id", "read", "Read one user's administrative profile and current wallet balance in TOMAN.", "path: id=user UUID or support code."),
  tool("admin_user_history", "users", "GET", "/admin/users/:id/history", "read", "Read the audited profile-change history for a user.", "path: id=user UUID or support code; query: section, page, limit."),
  tool("admin_user_notes", "users", "GET", "/admin/users/:id/notes", "read", "Read dated, author-attributed internal notes about a user.", "path: id=user UUID or support code; query: cursor note UUID, limit 1..30."),
  tool("admin_user_note_create", "users", "POST", "/admin/users/:id/notes", "write", "Add an immutable note to an active or blocked user account; share it with sellers only when explicitly requested.", "path: id=user UUID or support code; body: body text 3..1000 characters, sellerVisible boolean (default false keeps note admin-only)."),
  tool("admin_user_update", "users", "PATCH", "/admin/users/:id", "write", "Update allowlisted user profile fields.", "path: id=user UUID or support code; body: fullName, username, email and/or phoneNumber."),
  tool("admin_user_password_change", "users", "PATCH", "/admin/users/:id/password", "critical", "Replace a user's password and revoke all of their active sessions after owner password confirmation.", "path: id=user UUID or support code; body: currentPassword {$secureInput: owner password} and newPassword {$secureInput: new user password}."),

  tool("admin_staff_list", "staff", "GET", "/admin/staff", "read", "List platform staff and pending invitations."),
  tool("admin_staff_invite", "staff", "POST", "/admin/staff", "critical", "Invite a platform staff member with explicit permissions.", "body: {fullName,email,permissions,expiresInHours}."),
  tool("admin_staff_update", "staff", "PATCH", "/admin/staff/:id", "critical", "Change a staff member's name or platform permissions.", "path: id=staff user UUID or support code; body: fullName? and/or permissions?."),
  tool("admin_staff_revoke", "staff", "DELETE", "/admin/staff/:id", "destructive", "Revoke a pending staff invitation. Existing staff roles must be changed with admin_user_role and a reason.", "path: invitation UUID or staff user UUID or support code."),

  tool("admin_sellers_list", "sellers", "GET", "/seller/vendors", "read", "List seller organizations available to platform administration."),
  tool("admin_seller_create", "sellers", "POST", "/seller/vendors", "write", "Create a seller organization with default and optional product-type commission rates.", "body: owner identity, shop name, status, commission (0..1), optional commissionRates {digital,physical,service,bridge} (each null or 0..1), and permissions."),
  tool("admin_seller_update", "sellers", "PATCH", "/seller/vendors/:id", "write", "Update a seller organization and its default or product-type commission rates.", "path: id; body: allowlisted seller fields, optional commission (0..1), commissionRates {digital,physical,service,bridge} (each null or 0..1)."),
  tool("admin_seller_picture_upload", "sellers", "POST", "/seller/vendors/:id/picture", "write", "Upload or replace a seller's public profile picture.", "path: id=seller UUID; body: {file:{\"$fileInput\":{\"label\":\"Seller profile picture\",\"accept\":\"image/webp\",\"maxBytes\":8388608}}}."),
  tool("admin_seller_picture_remove", "sellers", "DELETE", "/seller/vendors/:id/picture", "destructive", "Remove a seller's public profile picture.", "path: id=seller UUID."),
  tool("admin_seller_agents", "sellers", "GET", "/seller/agents", "read", "List seller agents."),
  tool("admin_seller_agent_create", "sellers", "POST", "/seller/agents", "write", "Create a seller agent assignment.", "body: sellerId and agent identity fields."),
  tool("admin_seller_invites", "sellers", "GET", "/seller/invites", "read", "List seller invitations."),
  tool("admin_seller_invite", "sellers", "POST", "/seller/invites", "write", "Create a seller invitation.", "body: sellerId, email, role and permission fields."),
  tool("seller_profile_get", "sellers", "GET", "/seller/profile", "read", "Read the current actor's seller public profile when a seller context exists."),
  tool("seller_customers_search", "sellers", "GET", "/seller/customers", "read", "Search buyers who ordered from the current seller by name, email, username, phone, UUID or exact support code; return seller-specific order counts. Requires active orders_manage permission.", "query: search 3..100 characters, limit 1..30, cursor user UUID or support code."),
  tool("seller_customer_detail", "sellers", "GET", "/seller/customers/:id", "read", "Read the current seller's orders for a buyer who ordered from this seller, plus admin notes explicitly marked seller-visible. Requires active orders_manage permission.", "path: id=user UUID or support code; query: notesCursor UUID, ordersCursor UUID."),
  tool("seller_profile_update", "sellers", "PATCH", "/seller/profile", "write", "Update the current seller's public expert profile.", "body: public profile fields; requires seller context."),
  tool("seller_profile_picture_upload", "sellers", "POST", "/seller/profile/picture", "write", "Upload or replace the current seller's public profile picture with a WebP image.", "body: {file:{\"$fileInput\":{\"label\":\"Profile picture\",\"accept\":\"image/webp\",\"maxBytes\":8388608}}}; requires seller-admin context."),
  tool("seller_profile_picture_remove", "sellers", "DELETE", "/seller/profile/picture", "destructive", "Remove the current seller's public profile picture.", "requires seller-admin context."),

  tool("admin_products_list", "catalog", "GET", "/products/admin", "read", "Search and paginate the administrative product catalog, including counts for each product status under the other active filters.", "query: search, category, seller, status, stock (physical active offers), dateField (created or updated), dateFrom (inclusive UTC ISO instant) and dateTo (exclusive UTC ISO instant), type, kind, sort, cursor, limit."),
  tool("seller_product_description_templates", "catalog", "GET", "/products/templates", "read", "List active product description templates available to the authenticated seller.", "query: locale=fa|en|ar, optional cursor UUID and limit 1..50."),
  tool("admin_product_description_templates", "catalog", "GET", "/products/admin/templates", "read", "List product description templates, including inactive ones.", "query: locale=fa|en|ar, optional cursor UUID and limit 1..50."),
  tool("admin_product_description_template_create", "catalog", "POST", "/products/admin/templates", "write", "Create a localized product description template that sellers can apply to drafts.", "body: locale=fa|en|ar, name 1..100 characters, content 1..10000 characters, optional active boolean."),
  tool("admin_product_description_template_update", "catalog", "PATCH", "/products/admin/templates/:templateId", "write", "Edit or activate/deactivate a product description template.", "path: templateId UUID; body: optional name, content and active boolean."),
  tool("admin_products_bulk_edit_preview", "catalog", "POST", "/products/admin/bulk-edit/preview", "write", "Preview a bounded selection of product and offer edits, including before and after values and a revision.", "body: 1-50 productIds and one action with its bounded value."),
  tool("admin_products_bulk_edit_apply", "catalog", "POST", "/products/admin/bulk-edit", "destructive", "Apply a previewed product bulk edit atomically with an operation ID and exact revision.", "body: 1-50 productIds, one action and value, UUID operationId, and 64-character preview revision."),
  tool("admin_product_get", "catalog", "GET", "/products/admin/:productId", "read", "Read administrative product details, Bridge purchase limits, and paginated seller offers with effective commission and shipping readiness.", "path: productId; query: cursor and limit for seller listings."),
    tool("admin_product_update", "catalog", "PATCH", "/products/admin/:productId", "write", "Update product catalog fields, including its formatted description, tags, managed category, and unique public slug.", "path: productId; body: title, slug, categoryId (UUID or null) or category name, up to 20 tags of 50 characters each, status, description (plain text or versioned rich-text document string up to 10000 characters)."),
  tool("admin_product_transfer", "catalog", "POST", "/products/admin/:productId/transfer", "destructive", "Transfer product ownership and its unsold listing to another approved seller, with an audit record.", "path: productId; body: {sellerId: approved seller UUID}."),
  tool("admin_product_slug_availability", "catalog", "GET", "/products/admin/slug-availability", "read", "Check whether a product slug is available, including historic reserved slugs.", "query: slug and optional currentProductId UUID."),
  tool("admin_product_review", "catalog", "PATCH", "/products/admin/:productId/review", "write", "Approve, reject, archive, or otherwise review a product transition.", "path: productId; body: review status and optional reason."),
  tool("admin_product_translations", "catalog", "GET", "/products/admin/:productId/translations", "read", "List all translations for a product.", "path: productId."),
  tool("admin_product_translation_update", "catalog", "PATCH", "/products/admin/:productId/translations/:locale", "write", "Update an English or Arabic product translation draft with plain or formatted description.", "path: productId UUID, locale=en|ar; body: localized title and description (plain text or versioned rich-text document string up to 10000 characters), optional category. Both title and description are required."),
  tool("admin_product_translation_publish", "catalog", "POST", "/products/admin/:productId/translations/:locale/publish", "write", "Publish a product translation.", "path: productId and locale."),
  tool("admin_product_translation_unpublish", "catalog", "POST", "/products/admin/:productId/translations/:locale/unpublish", "destructive", "Unpublish a product translation.", "path: productId and locale."),
  tool("admin_product_changes", "catalog", "GET", "/products/admin/changes", "read", "List audited product changes.", "query: sellerId, action, cursor, limit."),
  tool("admin_product_change_history", "catalog", "GET", "/products/admin/:productId/changes", "read", "List audited changes for one product.", "path: productId; query: cursor, limit."),
  tool("admin_product_restore", "catalog", "POST", "/products/admin/:productId/restore", "destructive", "Restore a product to one side of a historical change.", "path: productId; body: {changeId,side}."),
  tool("admin_product_bulk_undo_preview", "catalog", "POST", "/products/admin/changes/bulk-undo/preview", "write", "Preview a bounded bulk product-change rollback.", "body: selected change IDs or bounded filters."),
  tool("admin_product_bulk_undo", "catalog", "POST", "/products/admin/changes/bulk-undo", "destructive", "Apply an approved bounded bulk product-change rollback.", "body: preview token and exact rollback selection."),
  tool("admin_product_listing_update", "catalog", "PATCH", "/products/admin/listings/:listingId", "write", "Change a seller listing's administrative status.", "path: listingId; body: {status}."),
  tool("admin_product_offer_update", "catalog", "PATCH", "/products/admin/offers/:offerId", "write", "Update an offer's price, stock, status, or download limit while enforcing the product currency and immutable download links.", "path: offerId; body: allowlisted offer fields; digital updates must repeat the original fileReferences and fileTitles; currency, when given, must match the product."),
  tool("admin_download_link_requests", "catalog", "GET", "/products/admin/download-link-requests", "read", "List up to 50 pending seller requests to edit or delete digital offer download links.", "No input."),
  tool("admin_download_link_request_review", "catalog", "PATCH", "/products/admin/download-link-requests/:requestId", "write", "Approve or reject a pending download link change after checking the current link and seller.", "path: requestId UUID; body: status approved or rejected, reason 3-500 characters required for rejection."),
  tool("admin_download_links_replace", "catalog", "PUT", "/products/admin/offers/:offerId/download-links", "destructive", "Replace a digital offer's download URL and title list directly as platform admin.", "path: offerId UUID; body: 1-50 unique unsigned HTTPS fileReferences and paired nonempty fileTitles."),
  tool("admin_product_category_update", "catalog", "PATCH", "/products/admin/categories/:categoryId", "write", "Update a product category, its parent, SEO fields and localized labels.", "path: categoryId; body: name, slug, description, metaTitle, metaDescription, parentId, translations."),
  tool("admin_product_categories_list", "catalog", "GET", "/products/admin/categories", "read", "List product categories with parent links and product counts.", "query: search, cursor, limit."),
  tool("admin_product_category_create", "catalog", "POST", "/products/admin/categories", "write", "Create a product category.", "body: name, slug, description, metaTitle, metaDescription, parentId, translations."),
  tool("admin_product_category_delete", "catalog", "DELETE", "/products/admin/categories/:categoryId", "destructive", "Delete a leaf category and explicitly move or uncategorize its products.", "path: categoryId; body: productAction and optional replacementCategoryId."),
  tool("admin_product_category_image_upload", "catalog", "POST", "/products/admin/categories/:categoryId/image", "write", "Upload a category image.", "path: categoryId; body: file using $fileInput, JPEG, PNG or WebP up to 8 MiB."),
  tool("admin_product_category_image_delete", "catalog", "DELETE", "/products/admin/categories/:categoryId/image", "destructive", "Remove a category image.", "path: categoryId."),
  tool("admin_product_image_upload", "catalog", "POST", "/products/admin/:productId/image", "write", "Upload and replace a product image selected locally in the browser.", "path: productId; body: {file:{\"$fileInput\":{\"label\":\"Product image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}}."),
  tool("admin_product_image_remove", "catalog", "DELETE", "/products/admin/:productId/image", "destructive", "Remove a product image and its generated variants.", "path: productId."),
  tool("seller_products_list", "catalog", "GET", "/products/mine", "read", "List products and offers for the current seller context.", "query: status, search, cursor, limit; requires seller authorization."),
  tool("seller_product_create", "catalog", "POST", "/products", "write", "Create a product in the current seller context with one authoritative price currency, a unique public slug and optional formatted description.", "body: validated title, optional slug, description (plain text or versioned rich-text document string up to 10000 characters), variants and initial offers all priced in TOMAN or all in USD; digital offers accept 1-50 HTTPS fileReferences and paired fileTitles up to 120 characters."),
  tool("seller_product_update", "catalog", "PATCH", "/products/:productId", "write", "Update a seller-owned product, including its public slug, tags, managed category, and formatted description.", "path: productId; body: title, slug, categoryId (UUID or null) or category name, up to 20 tags of 50 characters each, status, description (plain text or versioned rich-text document string up to 10000 characters)."),
  tool("seller_product_slug_availability", "catalog", "GET", "/products/mine/slug-availability", "read", "Check a product slug in the current seller context; a current product ID must be seller-owned.", "query: slug and optional currentProductId UUID."),
  tool("seller_product_image_upload", "catalog", "POST", "/products/:productId/image", "write", "Upload an image for a seller-owned product from the browser.", "path: productId; body: {file:{\"$fileInput\":{\"label\":\"Product image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}}."),
  tool("seller_product_image_remove", "catalog", "DELETE", "/products/:productId/image", "write", "Request admin approval to remove the image from a seller-owned product.", "path: productId."),
  tool("seller_product_offer_create", "catalog", "POST", "/products/:productId/offers", "write", "Create an offer using the product's existing price currency.", "path: productId; body: validated variant, price, matching currency, stock or digital delivery with 1-50 HTTPS fileReferences and paired fileTitles."),
  tool("seller_product_offer_update", "catalog", "PATCH", "/products/offers/:offerId", "write", "Update a seller-owned offer without changing the product currency or registered download links.", "path: offerId; body: allowlisted offer fields; digital updates must repeat the original fileReferences and fileTitles; currency, when given, must match the product."),
  tool("seller_download_link_add", "catalog", "POST", "/products/offers/:offerId/download-links", "write", "Add a new download URL to a digital offer owned by the current seller.", "path: offerId UUID; body: unsigned HTTPS url up to 2048 characters and nonempty title up to 120 characters."),
  tool("seller_download_link_requests", "catalog", "GET", "/products/offers/:offerId/download-link-requests", "read", "Read recent edit or deletion requests for a digital offer owned by the current seller.", "path: offerId UUID."),
  tool("seller_download_link_change_request", "catalog", "POST", "/products/offers/:offerId/download-link-requests", "write", "Request admin approval to edit or delete one download link on a seller-owned digital offer.", "path: offerId UUID; body: action edit or delete, zero-based linkIndex 0-49, and for edit an unsigned HTTPS url and nonempty title."),

  tool("admin_orders_list", "orders", "GET", "/orders", "read", "Search and paginate orders visible to the authenticated admin; seller order items include their product ID, and directory responses include counts for each order status group.", "query: view=directory for platform order counts, trash active|trashed, status or statusGroup (pending, processing, completed, cancelled, returned, other), productType, search, dateFrom, dateTo, sort, cursor, limit."),
  tool("purchase_orders_list", "orders", "GET", "/orders/purchases", "read", "List only the current actor's personal purchases with buyer-safe fields.", "query: cursor UUID, limit 1..50, optional status, productType, search, dateFrom, dateTo, sort; management filters are rejected."),
  tool("purchase_order_get", "orders", "GET", "/orders/purchases/:id", "read", "Read a buyer-safe personal order belonging to the current actor.", "path: id=order UUID."),
  tool("purchase_order_status", "orders", "PATCH", "/orders/purchases/:id/status", "critical", "Cancel or confirm delivery of the current actor's own purchase using buyer transition rules.", "path: id=order UUID; body: status=cancelled|delivered; Idempotency-Key UUID.", true),
  tool("admin_orders_export", "orders", "POST", "/orders/export", "write", "Download a UTF-8 CSV of up to 5000 platform orders matching directory filters, optionally restricted to selected order IDs.", "body: locale=fa|en|ar; columns=1..13 allowlisted column names; optional selectedIds=1..100 UUIDs, trash=active|trashed, search=3..100 chars, statusGroup, productType, dateFrom/dateTo=YYYY-MM-DD, sort=newest|oldest.", false, "download"),
  tool("admin_orders_new_count", "orders", "GET", "/orders/new-count", "read", "Count new orders since the admin's last seen timestamp."),
  tool("admin_orders_mark_seen", "orders", "POST", "/orders/seen", "write", "Advance the current actor's order-seen timestamp."),
  tool("admin_order_get", "orders", "GET", "/orders/admin/:id", "read", "Read comprehensive administrative order details, including each item's product ID.", "path: id."),
  tool("order_get", "orders", "GET", "/orders/:id", "read", "Read one order through the current actor's buyer or seller scope, including each item's product ID.", "path: id."),
  tool("buyer_digital_access", "orders", "GET", "/orders/digital-access/:offerId", "read", "Find the current buyer's latest downloadable purchase for an offer, including per-file limits.", "path: offerId UUID."),
  tool("buyer_free_download", "orders", "GET", "/orders/free-download/:offerId", "read", "Redirect an authenticated buyer to a signed file URL only when the active offer is free.", "path: offerId UUID; query: fileIndex 0-49.", false, "download"),
  tool("order_create", "orders", "POST", "/orders", "critical", "Create a personal order through the authenticated actor's supported legacy order flow.", "body: validated authoritative offer and fulfillment inputs.", true),
  tool("admin_order_status", "orders", "PATCH", "/orders/:id/status", "critical", "Perform an authorized order status transition, including completion from a fulfillment-ready state, with explicit admin confirmation.", "path: id UUID; body: {status, confirmSensitive?: true}; transition and payout rules remain enforced.", true),
  tool("admin_order_trash", "orders", "PATCH", "/orders/admin/:id/trash", "critical", "Move an order to trash or restore it while preserving financial records and audit history.", "path: id UUID; body: {trashed: boolean, confirm: true}.", true),
  tool("admin_order_shipping_update", "orders", "PATCH", "/orders/:id/shipping", "write", "Update an order's shipping address or shipment metadata.", "path: id; body: validated shipping fields."),
  tool("admin_order_shipping_register", "orders", "POST", "/orders/:id/shipping/register", "critical", "Register a shipment with the configured provider.", "path: id; body: provider shipment fields.", true),
  tool("admin_order_shipping_register_legacy", "orders", "POST", "/orders/:id/shipping/amadast", "critical", "Register a shipment through the legacy Amadast-compatible route.", "path: id; body: provider shipment fields.", true),
  tool("admin_order_shipping_sync", "orders", "POST", "/orders/:id/shipping/sync", "write", "Synchronize an order shipment with its provider.", "path: id."),
  tool("admin_order_shipping_sync_legacy", "orders", "POST", "/orders/:id/shipping/amadast/sync", "write", "Synchronize a shipment through the legacy Amadast-compatible route.", "path: id."),
  tool("order_item_download", "orders", "POST", "/orders/:orderId/items/:itemId/download", "write", "Claim one authorized digital download and return its signed URL.", "path: orderId and itemId; query: fileIndex when selecting among multiple files."),
  tool("orders_leaderboard", "orders", "GET", "/orders/leaderboard", "read", "Read the order leaderboard available to the authenticated actor.", "query: supported date and limit filters."),

  tool("payouts_list", "payouts", "GET", "/payouts", "read", "List payout ledger entries visible to the authenticated actor, optionally limited to requested payouts awaiting approval.", "query: status=requested, cursor UUID, limit 1-50."),
  tool("payout_get", "payouts", "GET", "/payouts/:id", "read", "Read one payout ledger entry.", "path: id."),
  tool("payout_request", "payouts", "POST", "/payouts/requests", "critical", "Create a payout request from authoritative payable balances.", "body: validated payout request fields.", true),
  tool("payout_transition", "payouts", "PATCH", "/payouts/requests/:id", "critical", "Perform an authorized payout state transition.", "path: id; body: transition and provider reference fields.", true),

  tool("admin_payment_methods", "payments", "GET", "/payments/admin/methods", "read", "List payment method configurations without secrets."),
  tool("payment_offer_methods", "payments", "GET", "/payments/methods/offer/:offerId", "read", "List enabled payment methods available for a bridge offer without exposing credentials.", "path: offerId UUID."),
  tool("admin_payment_method_update", "payments", "PATCH", "/payments/admin/methods/:providerCode", "critical", "Update a payment method, seller rules, product rules, and encrypted credentials, including Zibal merchant settings.", "path: providerCode; body: enabled, productTypes, sellerIds, optional merchantId, callbackUrl, and supported refund token fields."),
  tool("admin_payment_sellers", "payments", "GET", "/payments/admin/seller-options", "read", "Search sellers for payment-routing configuration.", "query: search, cursor, limit."),
  tool("admin_payment_transactions", "payments", "GET", "/payments/admin/transactions", "read", "Search and paginate payment attempts.", "query: provider, status, search, dates, cursor, limit."),
  tool("admin_payment_resolve", "payments", "POST", "/payments/admin/:attemptId/resolve", "critical", "Close an uninitiated attempt, or record a provider-confirmed cancellation or refund for an unresolved payment attempt so its reserved order can be released.", "path: attemptId UUID; body: {outcome: cancelled|refunded, providerEvidence: 10..500 characters, confirm: true}; Idempotency-Key UUID. Created attempts accept cancellation immediately; pending or unknown attempts require provider evidence and a stale initiation.", true),
  tool("admin_payment_refund", "payments", "POST", "/payments/admin/:attemptId/refund", "critical", "Request a bounded, idempotent payment refund.", "path: attemptId; body: amount and reason when supported.", true),
  tool("payment_initiate", "payments", "POST", "/payments/:providerCode", "critical", "Initiate payment for an authorized order using a selected provider.", "path: providerCode; body: orderId and validated return context.", true),
  tool("local_payment_get", "payments", "GET", "/payments/local/:authority", "read", "Read an authenticated local test-payment attempt.", "path: authority."),
  tool("local_payment_complete", "payments", "POST", "/payments/local/:authority/complete", "critical", "Complete or cancel an authenticated local test payment.", "path: authority; body: {status}."),

  tool("admin_blog_posts", "blog", "GET", "/blog/manage/posts", "read", "Search and paginate managed blog posts.", "query: status, sellerId, search, cursor, limit."),
  tool("admin_blog_create", "blog", "POST", "/blog/manage/posts", "write", "Create a blog draft."),
  tool("admin_blog_get", "blog", "GET", "/blog/manage/posts/:id", "read", "Read a complete managed blog post.", "path: id."),
  tool("admin_blog_update", "blog", "PATCH", "/blog/manage/posts/:id", "write", "Update a blog draft and its localized content using media authorized for the current actor and seller.", "path: id; body: revision, translations, taxonomy, relations and media references."),
  tool("admin_blog_submit", "blog", "POST", "/blog/manage/posts/:id/submit", "write", "Submit a seller-authored blog draft for review.", "path: id."),
  tool("admin_blog_publish", "blog", "POST", "/blog/manage/posts/:id/publish", "write", "Publish a reviewed blog revision after revalidating its attached media and seller scope.", "path: id; body: optimistic version where required."),
  tool("admin_blog_reject", "blog", "POST", "/blog/manage/posts/:id/reject", "write", "Reject a blog revision with a moderation note.", "path: id; body: moderation note and optimistic version."),
  tool("admin_blog_archive", "blog", "POST", "/blog/manage/posts/:id/archive", "destructive", "Archive a blog post.", "path: id."),
  tool("admin_blog_restore", "blog", "POST", "/blog/manage/posts/:id/restore", "write", "Restore an archived blog post.", "path: id."),
  tool("admin_blog_withdraw", "blog", "POST", "/blog/manage/posts/:id/withdraw", "write", "Withdraw a submitted blog revision.", "path: id."),
  tool("admin_blog_changes", "blog", "GET", "/blog/manage/posts/:id/changes", "read", "List audited changes for a blog post.", "path: id; query: cursor, limit."),
  tool("admin_blog_change_restore", "blog", "POST", "/blog/manage/posts/:id/changes/:changeId/restore", "destructive", "Restore a blog post from an audited change snapshot.", "path: id and changeId; body: side."),
  tool("admin_blog_product_options", "blog", "GET", "/blog/manage/product-options", "read", "Search products that can be related to a blog post.", "query: search, cursor, limit."),
  tool("admin_blog_sidebar_get", "blog", "GET", "/admin/blog-sidebar", "read", "Read the editable localized blog sidebar promotion.", "query: locale=fa|en|ar."),
  tool("admin_blog_sidebar_update", "blog", "PUT", "/admin/blog-sidebar", "write", "Update localized blog sidebar copy, destination, visibility, and up to three default products.", "query: locale=fa|en|ar; body: {version,content:{enabled,title,description,ctaLabel,ctaHref},productIds:[up to 3 UUIDs]}"),
  tool("admin_blog_taxonomy", "blog", "GET", "/blog/manage/taxonomy", "read", "List managed blog categories and tags."),
  tool("admin_blog_category_create", "blog", "POST", "/blog/manage/categories", "write", "Create a localized blog category.", "body: {translations:[{locale,name,slug,description?,metaTitle?,metaDescription?}]}"),
  tool("admin_blog_category_reorder", "blog", "PUT", "/blog/manage/categories/order", "write", "Set the display order of all blog categories.", "body: {ids:[all category UUIDs in display order, up to 500]}"),
  tool("admin_blog_category_update", "blog", "PATCH", "/blog/manage/categories/:id", "write", "Update a localized blog category, descriptions, and search metadata.", "path: id; body: {translations:[{locale,name,slug,description?,metaTitle?,metaDescription?}]}"),
  tool("admin_blog_category_delete", "blog", "DELETE", "/blog/manage/categories/:id", "destructive", "Delete an unused blog category.", "path: id."),
  tool("admin_blog_tag_create", "blog", "POST", "/blog/manage/tags", "write", "Create a localized blog tag.", "body: {translations:[{locale,name,slug,description?,metaTitle?,metaDescription?}]}"),
  tool("admin_blog_tag_reorder", "blog", "PUT", "/blog/manage/tags/order", "write", "Set the display order of all blog tags.", "body: {ids:[all tag UUIDs in display order, up to 500]}"),
  tool("admin_blog_tag_update", "blog", "PATCH", "/blog/manage/tags/:id", "write", "Update a localized blog tag, descriptions, and search metadata.", "path: id; body: {translations:[{locale,name,slug,description?,metaTitle?,metaDescription?}]}"),
  tool("admin_blog_tag_delete", "blog", "DELETE", "/blog/manage/tags/:id", "destructive", "Delete an unused blog tag.", "path: id."),
  tool("admin_blog_media_upload", "blog", "POST", "/blog/media", "write", "Upload blog media selected locally in the browser.", "body: kind, postId when applicable, and file:{\"$fileInput\":{\"label\":\"Blog image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":8388608}}."),

  tool("admin_coupons_list", "coupons", "GET", "/coupons/admin", "read", "Paginate seller and all-sellers coupons.", "query: sellerId, cursor, limit."),
  tool("admin_coupon_create", "coupons", "POST", "/coupons/admin", "write", "Create a coupon for one seller or all sellers.", "body: sellerId (UUID or null for all sellers), code, discount, currency, limits and validity window."),
  tool("admin_coupon_update", "coupons", "PATCH", "/coupons/admin/:id", "write", "Update a seller or all-sellers coupon.", "path: id; body: allowlisted coupon fields, including sellerId (UUID or null)."),
  tool("admin_coupon_delete", "coupons", "DELETE", "/coupons/admin/:id", "destructive", "Delete an unused seller or all-sellers coupon.", "path: id."),
  tool("seller_coupons_list", "coupons", "GET", "/coupons/mine", "read", "List coupons for the current seller context.", "query: cursor, limit."),
  tool("seller_coupon_create", "coupons", "POST", "/coupons", "write", "Create a coupon for the current seller context.", "body: code, discount, currency, limits and validity window."),

  tool("site_marketing_visit", "marketing", "POST", "/marketing/visit", "write", "Record a visit to an active product referral link and return its product slug and visit ID.", "body: {code: 16–32 character referral code}."),
  tool("seller_marketing_list", "marketing", "GET", "/marketing/seller", "read", "List the current seller's product referral links and performance.", "query: cursor (UUID)."),
  tool("seller_marketing_options", "marketing", "GET", "/marketing/seller/options", "read", "Find eligible products for the current seller's referral links.", "query: search (up to 80 characters)."),
  tool("seller_marketing_create", "marketing", "POST", "/marketing/seller", "write", "Create a seller funded product referral link for a named recipient.", "body: productId, recipientName, recipientContact?, percentage (1–30), expiresAt?."),
  tool("seller_marketing_update", "marketing", "PATCH", "/marketing/seller/:id", "write", "Activate, deactivate, or update the recipient for an owned referral link.", "path: id; body: active?, recipientName?, recipientContact?."),
  tool("seller_marketing_earnings", "marketing", "GET", "/marketing/seller/:id/earnings", "read", "List attributed purchases and commission status for an owned link.", "path: id; query: cursor."),
  tool("seller_marketing_events", "marketing", "GET", "/marketing/seller/:id/events", "read", "List the audit history for an owned referral link.", "path: id; query: cursor."),
  tool("admin_marketing_list", "marketing", "GET", "/marketing/admin", "read", "List referral links across sellers with visit, purchase, and commission totals.", "query: sellerId?, cursor?."),
  tool("admin_marketing_options", "marketing", "GET", "/marketing/admin/options", "read", "Find eligible seller product listings for a referral link.", "query: search (up to 80 characters)."),
  tool("admin_marketing_create", "marketing", "POST", "/marketing/admin", "write", "Create a seller or platform funded product referral link.", "body: sellerId, productId, recipientName, recipientContact?, percentage (1–30), fundingSource?, expiresAt?."),
  tool("admin_marketing_update", "marketing", "PATCH", "/marketing/admin/:id", "write", "Activate, deactivate, or update a referral recipient.", "path: id; body: active?, recipientName?, recipientContact?."),
  tool("admin_marketing_earnings", "marketing", "GET", "/marketing/admin/:id/earnings", "read", "List attributed purchases and commission states for a referral link.", "path: id; query: cursor."),
  tool("admin_marketing_events", "marketing", "GET", "/marketing/admin/:id/events", "read", "List the actor audit history for a referral link.", "path: id; query: cursor."),
  tool("admin_marketing_pay", "marketing", "POST", "/marketing/admin/earnings/:id/pay", "critical", "Record an externally completed commission payout after delivery, with a transfer reference.", "path: id; body: {reference: external payout reference}."),

  tool("admin_comments_list", "comments", "GET", "/admin/settings/comments", "read", "Search and paginate comments for moderation.", "query: status, target, search, locale, cursor, limit."),
  tool("admin_notification_counts", "notifications", "GET", "/admin/notifications/counts", "read", "Read exact pending request counts for all six administrator review queues."),
  tool("admin_comment_settings", "comments", "GET", "/admin/settings/comments/settings", "read", "Read comment moderation and publication settings."),
  tool("admin_comment_settings_update", "comments", "PATCH", "/admin/settings/comments/settings", "write", "Update comment moderation and publication settings.", "body: sellerLockEnabled, postingPolicy and publicationPolicy."),
  tool("admin_comment_approve", "comments", "POST", "/admin/settings/comments/:id/approve", "write", "Approve a pending comment.", "path: id."),
  tool("admin_comment_reject", "comments", "POST", "/admin/settings/comments/:id/reject", "write", "Reject a comment.", "path: id."),
  tool("admin_comment_spam", "comments", "POST", "/admin/settings/comments/:id/spam", "destructive", "Mark a comment as spam.", "path: id."),
  tool("admin_comment_restore", "comments", "POST", "/admin/settings/comments/:id/restore", "write", "Restore a moderated comment.", "path: id."),
  tool("admin_comment_reply", "comments", "POST", "/admin/settings/comments/:id/reply", "write", "Post an official reply to a comment.", "path: id; body: {body}."),
  tool("admin_comment_flag", "comments", "POST", "/admin/settings/comments/:id/flag", "write", "Flag a comment for review.", "path: id."),
  tool("seller_comment_status", "comments", "GET", "/comments/seller/status", "read", "Read whether the current seller workspace is comment-locked."),
  tool("seller_comments_list", "comments", "GET", "/comments/seller", "read", "List comments assigned to the current seller.", "query: locale, cursor, limit."),
  tool("seller_comment_reply", "comments", "POST", "/comments/seller/:commentId/reply", "write", "Reply to a comment assigned to the current seller.", "path: commentId; body: {body}."),
  tool("seller_comment_flag", "comments", "POST", "/comments/seller/:commentId/flag", "write", "Flag a comment assigned to the current seller.", "path: commentId."),

  tool("admin_bridge_connections", "bridge", "GET", "/bridge/admin/connections", "read", "List bridge connections without credentials."),
  tool("admin_bridge_services", "bridge", "GET", "/bridge/admin/services", "read", "List synchronized bridge services."),
  tool("admin_bridge_grant", "bridge", "POST", "/bridge/admin/grants", "critical", "Grant a seller access to a bridge service.", "body: sellerId and serviceId."),
  tool("admin_bridge_grant_revoke", "bridge", "POST", "/bridge/admin/grants/:id/revoke", "destructive", "Revoke a bridge service grant.", "path: id."),
  tool("admin_bridge_refunds", "bridge", "GET", "/bridge/admin/refund-requests", "read", "List pending bridge fulfillment refund requests in bounded pages.", "query: cursor UUID, limit 1-50."),
  tool("seller_bridge_connections", "bridge", "GET", "/bridge/connections", "read", "List bridge connections for the current seller context."),
  tool("seller_bridge_connection_create", "bridge", "POST", "/bridge/connections", "critical", "Create an encrypted bridge connection for the current seller.", "body: provider, name, URL, username and credential fields using secure-input placeholders."),
  tool("seller_bridge_connection_update", "bridge", "PATCH", "/bridge/connections/:id", "critical", "Update a seller bridge connection.", "path: id; body: allowlisted connection fields and secure credential placeholders."),
  tool("seller_bridge_connection_test", "bridge", "POST", "/bridge/connections/:id/test", "write", "Test a seller bridge connection.", "path: id."),
  tool("seller_bridge_connection_sync", "bridge", "POST", "/bridge/connections/:id/synchronize", "write", "Synchronize services from a seller bridge connection.", "path: id."),
  tool("seller_bridge_connection_delete", "bridge", "DELETE", "/bridge/connections/:id", "destructive", "Delete a seller bridge connection.", "path: id."),
  tool("seller_bridge_services", "bridge", "GET", "/bridge/services", "read", "List bridge services for the current seller context."),
  tool("seller_bridge_grants", "bridge", "GET", "/bridge/grants", "read", "List bridge service grants for the current seller context."),
  tool("seller_bridge_accept_schema", "bridge", "POST", "/bridge/products/:productId/accept-schema", "write", "Accept the current bridge product schema.", "path: productId; body: validated schema version fields."),
  tool("seller_bridge_orders", "bridge", "GET", "/bridge/orders", "read", "List bridge fulfillments for the current seller context.", "query: status, cursor, limit."),
  tool("seller_bridge_order_complete", "bridge", "POST", "/bridge/orders/:id/complete", "critical", "Complete a bridge fulfillment.", "path: id; body: validated fulfillment result."),
  tool("seller_bridge_order_retry", "bridge", "POST", "/bridge/orders/:id/retry", "write", "Retry an eligible failed bridge fulfillment after provider reconciliation; ambiguous submissions without a provider reference cannot be retried.", "path: id."),
  tool("bridge_refund_request", "bridge", "POST", "/bridge/orders/:id/refund-request", "critical", "Request a refund for an authorized bridge fulfillment.", "path: id; body: reason."),

  tool("admin_uploads_list", "uploads", "GET", "/admin/uploads", "read", "Search and paginate uploaded media assets.", "query: source, state, search, cursor, limit."),
  tool("admin_uploads_summary", "uploads", "GET", "/admin/uploads/summary", "read", "Read aggregate upload storage and state totals."),
  tool("admin_upload_get", "uploads", "GET", "/admin/uploads/:source/:id", "read", "Read one upload's metadata and safe preview link.", "path: source and id."),
  tool("admin_uploads_trash", "uploads", "POST", "/admin/uploads/trash", "destructive", "Move a bounded selection of media assets to trash.", "body: {items:[{source,id}],reason}."),
  tool("admin_uploads_restore", "uploads", "POST", "/admin/uploads/restore", "write", "Restore a bounded selection of trashed media assets.", "body: {items:[{source,id}]}"),
  tool("admin_upload_deletion_requests", "uploads", "GET", "/admin/uploads/deletion-requests", "read", "List pending seller upload deletion requests with linked content context when available.", "query: cursor UUID."),
  tool("admin_upload_deletion_approve", "uploads", "POST", "/admin/uploads/deletion-requests/:id/approve", "destructive", "Approve a seller request and move the upload to recoverable trash.", "path: request UUID."),
  tool("admin_upload_deletion_reject", "uploads", "POST", "/admin/uploads/deletion-requests/:id/reject", "write", "Reject a seller upload deletion request.", "path: request UUID; body: reason (3-500 characters)."),
  tool("seller_uploads_list", "uploads", "GET", "/seller/uploads", "read", "List uploads for the authenticated seller only.", "query: source, state, linked, sort, search, cursor, limit."),
  tool("seller_uploads_summary", "uploads", "GET", "/seller/uploads/summary", "read", "Read upload and storage totals for the authenticated seller.", "No input."),
  tool("seller_upload_deletion_request", "uploads", "POST", "/seller/uploads/:source/:id/deletion-request", "write", "Request administrative approval to delete an owned upload.", "path: source and asset UUID; body: reason (3-500 characters)."),

  tool("admin_notice_get", "settings", "GET", "/admin/settings/notice", "read", "Read the platform notice settings."),
  tool("admin_upload_centers_get", "settings", "GET", "/admin/settings/upload-centers", "read", "Read the free and regular product upload center URLs."),
  tool("admin_upload_centers_update", "settings", "PATCH", "/admin/settings/upload-centers", "write", "Set the free and regular product upload center URLs.", "body: freeUrl and regularUrl, each empty or an HTTPS URL up to 2048 characters without credentials."),
  tool("admin_notice_update", "settings", "PATCH", "/admin/settings/notice", "write", "Update or clear the platform notice.", "body: localized message and enabled state."),
  tool("admin_homepage_get", "settings", "GET", "/admin/homepage", "read", "Read the editable homepage document."),
  tool("admin_homepage_update", "settings", "PUT", "/admin/homepage", "write", "Replace the validated localized homepage document.", "body: complete homepage document."),
  tool("admin_homepage_image_upload", "settings", "POST", "/admin/homepage/images", "write", "Upload a homepage image selected locally in the browser.", "body: {file:{\"$fileInput\":{\"label\":\"Homepage image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}}."),
  tool("admin_stories_list", "settings", "GET", "/admin/stories", "read", "List all homepage stories, including disabled stories.", "query: locale."),
  tool("admin_story_create", "settings", "POST", "/admin/stories", "write", "Create a homepage story with an image selected locally in the browser.", "body: locale, title, targetUrl, position, enabled, and file:{\"$fileInput\":{\"label\":\"Story image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}."),
  tool("admin_story_update", "settings", "PATCH", "/admin/stories/:id", "write", "Update a homepage story, optionally replacing its image from the browser.", "path: id; body: locale, title, targetUrl, position, enabled, and optional file placeholder copied from admin_story_create."),
  tool("admin_story_delete", "settings", "DELETE", "/admin/stories/:id", "destructive", "Delete a homepage story and its media.", "path: id."),
  tool("admin_auth_settings", "security", "GET", "/admin/settings/auth", "read", "Read enabled authentication methods."),
  tool("admin_auth_settings_update", "security", "PATCH", "/admin/settings/auth", "critical", "Enable or disable password and OTP login methods while preserving a usable login path.", "body: emailPasswordEnabled and phoneOtpEnabled."),
  tool("admin_security_policies", "security", "GET", "/admin/security/policies", "read", "List rate-limit and abuse-control policies."),
  tool("admin_security_policy_update", "security", "PATCH", "/admin/security/policies/:action", "critical", "Update one bounded security policy.", "path: action; body: subject/ip limits and window values."),
  tool("admin_sms_settings", "settings", "GET", "/admin/settings/sms", "read", "Read SMS provider settings with credentials redacted."),
  tool("admin_sms_settings_update", "settings", "PATCH", "/admin/settings/sms", "critical", "Update SMS provider, sender line, scan interval, and encrypted credentials.", "body: provider configuration, optional lineNumber and pendingCheckMinutes; omit unchanged secrets."),
  tool("admin_sms_rules", "settings", "GET", "/admin/settings/sms/rules", "read", "List SMS event and recipient rules."),
  tool("admin_sms_rule_create", "settings", "POST", "/admin/settings/sms/rules", "critical", "Create a validated SMS event and recipient rule.", "body: eventKey, productType, recipientKind, optional role or phone, enabled, templateId or messageText."),
  tool("admin_sms_rule_update", "settings", "PATCH", "/admin/settings/sms/rules/:id", "critical", "Update an SMS event and recipient rule.", "path: id; body: complete validated rule."),
  tool("admin_sms_rule_delete", "settings", "DELETE", "/admin/settings/sms/rules/:id", "critical", "Delete an SMS rule.", "path: id."),
  tool("admin_sms_deliveries", "settings", "GET", "/admin/settings/sms/deliveries", "read", "List masked SMS delivery and error records.", "query: optional eventKey, status and cursor."),
  tool("admin_goghdi_settings", "settings", "GET", "/admin/settings/goghdi", "read", "Read Goghdi integration settings with credentials redacted."),
  tool("admin_goghdi_settings_update", "settings", "PATCH", "/admin/settings/goghdi", "critical", "Update Goghdi integration settings and encrypted credentials.", "body: validated connection configuration; omit unchanged secrets."),
  tool("admin_shipping_settings", "settings", "GET", "/admin/settings/shipping", "read", "Read global shipping settings with secrets redacted."),
    tool("admin_shipping_settings_update", "settings", "PATCH", "/admin/settings/shipping", "critical", "Update global shipping provider settings and credentials.", "body: validated shipping configuration."),
    tool("admin_shipping_policy", "settings", "GET", "/admin/settings/shipping/policy", "read", "Read postal shipping rates, payer, free shipping, destination and parcel rules."),
    tool("admin_shipping_policy_update", "settings", "PATCH", "/admin/settings/shipping/policy", "critical", "Update global and seller postal shipping rules.", "body: defaultRule, sellerRules (up to 100), and updatedAt for conflict detection."),
  tool("admin_shipping_profiles", "settings", "GET", "/admin/settings/shipping/profiles", "read", "Search seller shipping profiles.", "query: search, cursor, limit."),
  tool("admin_shipping_profile_update", "settings", "PATCH", "/admin/settings/shipping/profiles/:sellerId", "write", "Update a seller shipping profile.", "path: sellerId; body: address, coordinates and provider settings."),
  tool("admin_shipping_places", "settings", "POST", "/admin/settings/shipping/profiles/:sellerId/places", "write", "Look up provider places for a seller shipping profile.", "path: sellerId; body: parent place identifiers."),
  tool("seller_shipping_profile", "settings", "GET", "/shipping/profile", "read", "Read the current seller's shipping profile."),
  tool("seller_shipping_profile_update", "settings", "PATCH", "/shipping/profile", "write", "Update the current seller's shipping profile.", "body: address, coordinates and provider location fields."),
  tool("seller_shipping_places", "settings", "POST", "/shipping/profile/places", "write", "Look up shipping-provider places for the current seller.", "body: parent place identifiers."),
  tool("admin_usd_settings", "settings", "GET", "/admin/settings/usd", "read", "Read USD exchange-rate configuration."),
  tool("admin_usd_settings_update", "settings", "PATCH", "/admin/settings/usd", "critical", "Update the authoritative USD exchange rate and pricing behavior.", "body: rate, source and activation fields."),

  tool("admin_backup_overview", "backup", "GET", "/admin/backups/overview", "read", "Read backup health, settings, destinations and recent activity."),
  tool("admin_backup_settings", "backup", "GET", "/admin/backups/settings", "read", "Read backup schedule and retention settings."),
  tool("admin_backup_settings_update", "backup", "PATCH", "/admin/backups/settings", "critical", "Update backup scheduling, retention and component settings.", "body: validated schedule, retention and component fields."),
  tool("admin_backup_destinations", "backup", "GET", "/admin/backups/destinations", "read", "List backup destinations with credentials redacted."),
  tool("admin_backup_destination_create", "backup", "POST", "/admin/backups/destinations", "critical", "Create an encrypted backup destination.", "body: destination type and validated connection settings."),
  tool("admin_backup_destination_update", "backup", "PATCH", "/admin/backups/destinations/:id", "critical", "Update a backup destination.", "path: id; body: allowlisted settings; omit unchanged secrets."),
  tool("admin_backup_destination_delete", "backup", "DELETE", "/admin/backups/destinations/:id", "destructive", "Delete a backup destination configuration.", "path: id."),
  tool("admin_backup_destination_test", "backup", "POST", "/admin/backups/destinations/:id/test", "write", "Test a backup destination connection.", "path: id."),
  tool("admin_backup_runs", "backup", "GET", "/admin/backups/runs", "read", "List backup runs and delivery status.", "query: cursor, limit."),
  tool("admin_backup_run_get", "backup", "GET", "/admin/backups/runs/:id", "read", "Read one backup run and its deliveries.", "path: id."),
  tool("admin_backup_run_create", "backup", "POST", "/admin/backups/runs", "critical", "Queue a manual backup run; uploads include referenced blog, product, seller profile, homepage and story images.", "body: {components:[...]}."),
  tool("admin_backup_remote_refresh", "backup", "POST", "/admin/backups/runs/remote-refresh", "write", "Refresh the bounded remote archive catalog for a destination.", "body: {destinationId}."),
  tool("admin_backup_retry", "backup", "POST", "/admin/backups/runs/:id/retry-deliveries", "write", "Retry failed deliveries for a completed backup.", "path: id."),
  tool("admin_backup_download", "backup", "GET", "/admin/backups/runs/:id/download", "read", "Download a completed backup archive to the owner's browser.", "path: id.", false, "download"),
  tool("admin_restore_upload", "backup", "POST", "/admin/backups/restore-uploads", "critical", "Upload a backup archive selected locally in the browser for restore preflight.", "body: {file:{\"$fileInput\":{\"label\":\"Backup archive\",\"accept\":\".topgsm-backup\",\"maxBytes\":1073741824}}}."),
  tool("admin_restore_preflight", "backup", "POST", "/admin/backups/restores/preflight", "critical", "Validate a local or remote backup archive and create a restore challenge.", "body: validated local-run or remote-archive source."),
  tool("admin_restore_confirm", "backup", "POST", "/admin/backups/restores/confirm", "critical", "Confirm a destructive restore using a valid preflight challenge and exact phrase.", "body: challengeId, confirmation phrase and source proof."),

  tool("admin_ai_profiles", "ai", "GET", "/ai/model-profiles", "read", "List AI model profiles without API keys."),
  tool("admin_ai_profile_create", "ai", "POST", "/ai/model-profiles", "critical", "Create an encrypted AI model profile.", "body: name, provider, modelId, baseUrl, apiKey and optional pricing."),
  tool("admin_ai_profile_update", "ai", "PATCH", "/ai/model-profiles/:id", "critical", "Update an AI model profile; omit unchanged API keys.", "path: id; body: allowlisted profile fields."),
  tool("admin_ai_profile_test", "ai", "POST", "/ai/model-profiles/:id/test", "write", "Test and activate an AI model profile.", "path: id."),
  tool("admin_ai_profile_deactivate", "ai", "POST", "/ai/model-profiles/:id/deactivate", "destructive", "Deactivate an AI model profile and remove its capability bindings.", "path: id."),
  tool("admin_ai_profile_delete", "ai", "DELETE", "/ai/model-profiles/:id", "destructive", "Delete an unused AI model profile.", "path: id."),
  tool("admin_ai_binding_get", "ai", "GET", "/ai/capabilities/:key/profile", "read", "Read the model profile bound to an AI capability.", "path: key."),
  tool("admin_ai_binding_update", "ai", "PUT", "/ai/capabilities/:key/profile", "critical", "Bind an active model profile to an AI capability.", "path: key; body: {profileId}."),

  tool("authoring_ai_profile", "ai", "GET", "/ai/authoring/:kind", "read", "Read the configured writing-assistant profile for a supported authoring kind.", "path: kind."),
  tool("authoring_ai_generate", "ai", "POST", "/ai/authoring/:kind", "write", "Generate a bounded draft without publishing it.", "path: kind; body: source notes and requested locale/fields."),
  tool("goghdi_order_ticket", "site", "POST", "/goghdi/order-ticket", "write", "Create a signed Goghdi chat ticket for an authorized purchased order item.", "body: orderId and itemId.")
] as const;

const MAX_TOOL_BODY_BYTES = 64_000;
const MAX_QUERY_KEYS = 30;
const MAX_PATH_VALUE_LENGTH = 300;
const PATH_PARAMETER = /:([A-Za-z][A-Za-z0-9_]*)/g;
const FORBIDDEN_INPUT_KEYS = /(?:authorization|cookie|password|secret|token|api.?key|credential|encrypted_.+|encryption_key_id)/i;
const REDACTED_RESULT_KEYS = /(?:authorization|cookie|password|secret|token|api.?key|credential|encrypted_.+|encryption_key_id|email|phone|mobile|address|postal|card.?number|iban|sheba)/i;

function hasAsciiControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f;
  });
}

@Injectable()
export class AdminToolCatalogService {
  private readonly byName = new Map(ADMIN_TOOL_CATALOG.map((entry) => [entry.name, entry]));

  constructor() {
    if (this.byName.size !== ADMIN_TOOL_CATALOG.length) throw new Error("Admin AI tool names must be unique");
    for (const entry of ADMIN_TOOL_CATALOG) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(entry.name)) throw new Error(`Invalid admin AI tool name: ${entry.name}`);
    }
  }

  list() {
    return ADMIN_TOOL_CATALOG.map((entry) => ({ ...entry, requiresApproval: !this.canAutoExecute(entry.name) }));
  }

  domainSummary() {
    const counts = new Map<string, number>();
    for (const entry of ADMIN_TOOL_CATALOG) counts.set(entry.domain, (counts.get(entry.domain) ?? 0) + 1);
    return [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([domain, count]) => `${domain} (${count})`).join(", ");
  }

  capabilitySummary() {
    const domains = new Map<string, AdminToolDefinition[]>();
    for (const entry of ADMIN_TOOL_CATALOG) domains.set(entry.domain, [...(domains.get(entry.domain) ?? []), entry]);
    return [...domains]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, entries]) => ({
        domain,
        toolCount: entries.length,
        read: entries.filter((entry) => entry.risk === "read").length,
        write: entries.filter((entry) => entry.risk === "write").length,
        destructive: entries.filter((entry) => entry.risk === "destructive").length,
        critical: entries.filter((entry) => entry.risk === "critical").length,
        examples: entries.slice(0, 2).map((entry) => ({ name: entry.name, description: entry.description }))
      }));
  }

  search(query = "", domain?: string, limit = 40) {
    const normalizedQuery = query.trim().toLowerCase().replaceAll("ي", "ی").replaceAll("ك", "ک").slice(0, 200);
    const tokens = normalizedQuery.split(/[^\p{L}\p{N}_-]+/u).filter((token) => token.length >= 2).slice(0, 12);
    const searchTerms = [...new Set([...tokens, ...SEARCH_ALIASES.filter(({ pattern }) => pattern.test(normalizedQuery)).flatMap(({ terms }) => terms)])];
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return ADMIN_TOOL_CATALOG
      .filter((entry) => !domain || entry.domain === domain)
      .map((entry) => {
        const haystack = `${entry.name} ${entry.domain} ${entry.method} ${entry.path} ${entry.description} ${entry.inputHint}`.toLowerCase();
        const score = (normalizedQuery && haystack.includes(normalizedQuery) ? 20 : 0) + searchTerms.reduce((sum, token) => sum + (haystack.includes(token) ? 3 : 0), 0);
        return { entry, score };
      })
      .filter(({ score }) => !normalizedQuery || score > 0)
      .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
      .slice(0, boundedLimit)
      .map(({ entry }) => ({ ...entry, requiresApproval: !this.canAutoExecute(entry.name) }));
  }

  compactPrompt(query: string) {
    const shortlist = this.search(query, undefined, 16);
    return `Domains: ${this.domainSummary()}\nFor the owner's own shop, pass input.workspace="seller" to run existing seller tools with verified seller-only authority. Omit workspace for platform-wide administration and admin_own_shop_create.\nLikely tools for the current request:\n${shortlist.map((entry) => `- ${entry.name} [${entry.risk}] ${entry.method} ${entry.path}: ${entry.description} Input: ${entry.inputHint}`).join("\n") || "- No lexical match. Use tool discovery with English keywords."}`;
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  canAutoExecute(name: string): boolean {
    const definition = this.byName.get(name);
    return definition?.risk === "read" && definition.method === "GET" && (definition.responseMode ?? "json") === "json";
  }

  prepare(name: string, rawInput: unknown): PreparedAdminTool {
    const definition = this.byName.get(name);
    if (!definition) throw new BadRequestException("The requested admin AI tool is not allowlisted");
    const input = this.normalizeInput(rawInput);
    const requiredPathKeys = [...definition.path.matchAll(PATH_PARAMETER)].map((match) => match[1]!);
    const suppliedPathKeys = Object.keys(input.path ?? {});
    if (requiredPathKeys.length !== suppliedPathKeys.length || requiredPathKeys.some((key) => !suppliedPathKeys.includes(key))) {
      throw new BadRequestException(`Tool '${name}' requires path values: ${requiredPathKeys.join(", ") || "none"}`);
    }
    let resolvedPath = definition.path;
    for (const key of requiredPathKeys) resolvedPath = resolvedPath.replace(`:${key}`, encodeURIComponent(input.path![key]!));
    return {
      name: definition.name,
      domain: definition.domain,
      method: definition.method,
      path: resolvedPath,
      query: input.query ?? {},
      ...(input.workspace ? { workspace: input.workspace } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      risk: definition.risk,
      description: input.workspace === "seller" ? `Own shop only: ${definition.description}` : definition.description,
      responseMode: definition.responseMode ?? "json",
      ...(definition.idempotent ? { idempotencyKey: randomUUID() } : {})
    };
  }

  sanitizeResult(value: unknown): { value: AdminToolJson; truncated: boolean } {
    let truncated = false;
    const visit = (item: unknown, depth: number): AdminToolJson => {
      if (depth > 8) { truncated = true; return "[depth truncated]"; }
      if (item === null || typeof item === "boolean") return item;
      if (typeof item === "number") return Number.isFinite(item) ? item : String(item);
      if (typeof item === "string") { if (item.length <= 4_000) return item; truncated = true; return `${item.slice(0, 4_000)}…`; }
      if (Array.isArray(item)) { if (item.length > 100) truncated = true; return item.slice(0, 100).map((child) => visit(child, depth + 1)); }
      if (typeof item === "object") {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length > 100) truncated = true;
        return Object.fromEntries(entries.slice(0, 100).map(([key, child]) => [key, REDACTED_RESULT_KEYS.test(key) ? "[redacted]" : visit(child, depth + 1)]));
      }
      return String(item);
    };
    const sanitized = visit(value, 0);
    const encoded = JSON.stringify(sanitized);
    if (Buffer.byteLength(encoded, "utf8") <= MAX_TOOL_BODY_BYTES) return { value: sanitized, truncated };
    return { value: `${Buffer.from(encoded, "utf8").subarray(0, MAX_TOOL_BODY_BYTES).toString("utf8")}…`, truncated: true };
  }

  private normalizeInput(value: unknown): AdminToolInput {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException("Admin AI tool input must be an object");
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).some((key) => !["path", "query", "body", "workspace"].includes(key))) throw new BadRequestException("Admin AI tool input contains an unsupported field");
    if (raw.workspace !== undefined && raw.workspace !== "seller") throw new BadRequestException("Admin AI workspace must be seller when provided");
    const path = this.record(raw.path, "path", 12);
    const normalizedPath = Object.fromEntries(Object.entries(path).map(([key, item]) => {
      if (FORBIDDEN_INPUT_KEYS.test(key)) throw new BadRequestException(`Admin AI tool path field '${key}' cannot contain credential material`);
      if (typeof item !== "string" || !item.trim() || item.length > MAX_PATH_VALUE_LENGTH || hasAsciiControlCharacter(item)) throw new BadRequestException(`Invalid path value '${key}'`);
      return [key, item.trim()];
    }));
    const query = this.record(raw.query, "query", MAX_QUERY_KEYS);
    const normalizedQuery = Object.fromEntries(Object.entries(query).map(([key, item]) => {
      if (FORBIDDEN_INPUT_KEYS.test(key)) throw new BadRequestException(`Admin AI tool query field '${key}' cannot contain credential material`);
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 50 || values.some((child) => !["string", "number", "boolean"].includes(typeof child) || (typeof child === "string" && (child.length > 2_000 || hasAsciiControlCharacter(child))) || (typeof child === "number" && !Number.isFinite(child)))) throw new BadRequestException(`Invalid query value '${key}'`);
      return [key, Array.isArray(item) ? values as Array<string | number | boolean> : item as string | number | boolean];
    }));
    if (raw.body !== undefined && Buffer.byteLength(JSON.stringify(raw.body), "utf8") > MAX_TOOL_BODY_BYTES) throw new BadRequestException("Admin AI tool body is too large");
    this.assertJson(raw.body, 0);
    return { ...(raw.workspace === "seller" ? { workspace: "seller" as const } : {}), ...(Object.keys(normalizedPath).length ? { path: normalizedPath } : {}), ...(Object.keys(normalizedQuery).length ? { query: normalizedQuery } : {}), ...(raw.body !== undefined ? { body: raw.body as AdminToolJson } : {}) };
  }

  private record(value: unknown, label: string, maxKeys: number): Record<string, unknown> {
    if (value === undefined) return {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException(`Admin AI tool ${label} must be an object`);
    const result = value as Record<string, unknown>;
    if (Object.keys(result).length > maxKeys || Object.keys(result).some((key) => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key))) throw new BadRequestException(`Admin AI tool ${label} is invalid`);
    return result;
  }

  private assertJson(value: unknown, depth: number): void {
    if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") { if (!Number.isFinite(value)) throw new BadRequestException("Admin AI tool body contains a non-finite number"); return; }
    if (depth > 12) throw new BadRequestException("Admin AI tool body is too deeply nested");
    if (Array.isArray(value)) { if (value.length > 500) throw new BadRequestException("Admin AI tool body array is too large"); value.forEach((item) => this.assertJson(item, depth + 1)); return; }
    if (this.filePlaceholder(value)) return;
    if (typeof value === "object") { const entries = Object.entries(value as Record<string, unknown>); if (entries.some(([key]) => key === "$fileInput")) throw new BadRequestException("Admin AI file input placeholder is invalid"); if (entries.length > 200) throw new BadRequestException("Admin AI tool body object is too large"); entries.forEach(([key, item]) => { if (FORBIDDEN_INPUT_KEYS.test(key) && !this.securePlaceholder(item)) throw new BadRequestException(`Admin AI tool body field '${key}' requires a browser-only secure input placeholder`); this.assertJson(item, depth + 1); }); return; }
    throw new BadRequestException("Admin AI tool body must contain JSON values only");
  }
  private securePlaceholder(value: unknown) { return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1 && typeof (value as { $secureInput?: unknown }).$secureInput === "string" && (value as { $secureInput: string }).$secureInput.length >= 2 && (value as { $secureInput: string }).$secureInput.length <= 80); }
  private filePlaceholder(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1) return false;
    const spec = (value as { $fileInput?: unknown }).$fileInput;
    return Boolean(spec && typeof spec === "object" && !Array.isArray(spec) && Object.keys(spec).every((key) => ["label", "accept", "maxBytes"].includes(key)) && typeof (spec as { label?: unknown }).label === "string" && (spec as { label: string }).label.length >= 2 && (spec as { label: string }).label.length <= 80 && typeof (spec as { accept?: unknown }).accept === "string" && (spec as { accept: string }).accept.length <= 200 && Number.isInteger((spec as { maxBytes?: unknown }).maxBytes) && Number((spec as { maxBytes: number }).maxBytes) > 0 && Number((spec as { maxBytes: number }).maxBytes) <= 1_073_741_824);
  }
}
