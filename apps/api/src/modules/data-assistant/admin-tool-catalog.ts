import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export type AdminToolRisk = "read" | "write" | "destructive" | "critical";
export type AdminToolMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AdminToolJson = null | boolean | number | string | AdminToolJson[] | { [key: string]: AdminToolJson };
export type AdminToolInput = {
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

/**
 * API operations exposed to the owner-only admin assistant. Local file inputs and
 * downloads are browser-mediated; authentication-session changes, one-time
 * restore monitors, CAPTCHA/OTP flows, and provider callbacks stay in their
 * dedicated user flows.
 */
export const ADMIN_TOOL_CATALOG: readonly AdminToolDefinition[] = [
  tool("site_notice_get", "site", "GET", "/notice", "read", "Read the public platform notice."),
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
  tool("site_checkout_quote", "checkout", "POST", "/checkouts/quote", "write", "Price and validate a prospective cart without creating an order.", "body: {items:[{offerId,quantity,serviceNote?}], couponCode?}."),
  tool("site_shipping_places", "checkout", "POST", "/checkouts/shipping-places", "write", "Look up allowed shipping places for the checkout selection.", "body: provider and parent place identifiers."),
  tool("site_checkout_create", "checkout", "POST", "/checkouts", "critical", "Create a checkout for the authenticated actor.", "body: checkout items, address, shipping and optional coupon fields.", true),
  tool("site_checkout_get", "checkout", "GET", "/checkouts/:id", "read", "Read an authenticated checkout.", "path: id."),
  tool("site_checkout_pay", "checkout", "POST", "/checkouts/:id/payment-groups/:groupId/initiate", "critical", "Initiate payment for a checkout payment group.", "path: id and groupId.", true),
  tool("analytics_overview", "analytics", "GET", "/analytics/overview", "read", "Read the authenticated actor's analytics overview.", "query: supported analytics date filters."),

  tool("admin_users_list", "users", "GET", "/admin/users", "read", "Search and paginate platform users.", "query: role, search, cursor, limit."),
  tool("admin_user_get", "users", "GET", "/admin/users/:id", "read", "Read one user's administrative profile.", "path: id."),
  tool("admin_user_history", "users", "GET", "/admin/users/:id/history", "read", "Read the audited profile-change history for a user.", "path: id; query: cursor, limit."),
  tool("admin_user_update", "users", "PATCH", "/admin/users/:id", "write", "Update allowlisted user profile fields.", "path: id; body: fullName, username, email and/or phoneNumber."),

  tool("admin_staff_list", "staff", "GET", "/admin/staff", "read", "List platform staff and pending invitations."),
  tool("admin_staff_invite", "staff", "POST", "/admin/staff", "critical", "Invite a platform staff member with explicit permissions.", "body: {fullName,email,permissions,expiresInHours}."),
  tool("admin_staff_update", "staff", "PATCH", "/admin/staff/:id", "critical", "Change a staff member's name or platform permissions.", "path: id; body: fullName? and/or permissions?."),
  tool("admin_staff_revoke", "staff", "DELETE", "/admin/staff/:id", "destructive", "Revoke a staff member or pending invitation.", "path: id."),

  tool("admin_sellers_list", "sellers", "GET", "/seller/vendors", "read", "List seller organizations available to platform administration."),
  tool("admin_seller_create", "sellers", "POST", "/seller/vendors", "write", "Create a seller organization.", "body: owner identity, shop name, slug, status and permission fields."),
  tool("admin_seller_update", "sellers", "PATCH", "/seller/vendors/:id", "write", "Update a seller organization and its platform-managed state.", "path: id; body: allowlisted seller fields."),
  tool("admin_seller_agents", "sellers", "GET", "/seller/agents", "read", "List seller agents."),
  tool("admin_seller_agent_create", "sellers", "POST", "/seller/agents", "write", "Create a seller agent assignment.", "body: sellerId and agent identity fields."),
  tool("admin_seller_invites", "sellers", "GET", "/seller/invites", "read", "List seller invitations."),
  tool("admin_seller_invite", "sellers", "POST", "/seller/invites", "write", "Create a seller invitation.", "body: sellerId, email, role and permission fields."),
  tool("seller_profile_get", "sellers", "GET", "/seller/profile", "read", "Read the current actor's seller public profile when a seller context exists."),
  tool("seller_profile_update", "sellers", "PATCH", "/seller/profile", "write", "Update the current seller's public expert profile.", "body: public profile fields; requires seller context."),
  tool("seller_profile_picture_upload", "sellers", "POST", "/seller/profile/picture", "write", "Upload or replace the current seller's public profile picture.", "body: {file:{\"$fileInput\":{\"label\":\"Profile picture\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":8388608}}}; requires seller-admin context."),
  tool("seller_profile_picture_remove", "sellers", "DELETE", "/seller/profile/picture", "destructive", "Remove the current seller's public profile picture.", "requires seller-admin context."),

  tool("admin_products_list", "catalog", "GET", "/products/admin", "read", "Search and paginate the administrative product catalog.", "query: search, status, type, sellerId, cursor, limit."),
  tool("admin_product_get", "catalog", "GET", "/products/admin/:productId", "read", "Read complete administrative product details.", "path: productId."),
  tool("admin_product_update", "catalog", "PATCH", "/products/admin/:productId", "write", "Update the platform-owned fields of a product.", "path: productId; body: allowlisted product fields."),
  tool("admin_product_review", "catalog", "PATCH", "/products/admin/:productId/review", "write", "Approve, reject, archive, or otherwise review a product transition.", "path: productId; body: review status and optional reason."),
  tool("admin_product_translations", "catalog", "GET", "/products/admin/:productId/translations", "read", "List all translations for a product.", "path: productId."),
  tool("admin_product_translation_update", "catalog", "PATCH", "/products/admin/:productId/translations/:locale", "write", "Update a product translation draft.", "path: productId and locale; body: localized title, slug, description and SEO fields."),
  tool("admin_product_translation_publish", "catalog", "POST", "/products/admin/:productId/translations/:locale/publish", "write", "Publish a product translation.", "path: productId and locale."),
  tool("admin_product_translation_unpublish", "catalog", "POST", "/products/admin/:productId/translations/:locale/unpublish", "destructive", "Unpublish a product translation.", "path: productId and locale."),
  tool("admin_product_changes", "catalog", "GET", "/products/admin/changes", "read", "List audited product changes.", "query: sellerId, action, cursor, limit."),
  tool("admin_product_change_history", "catalog", "GET", "/products/admin/:productId/changes", "read", "List audited changes for one product.", "path: productId; query: cursor, limit."),
  tool("admin_product_restore", "catalog", "POST", "/products/admin/:productId/restore", "destructive", "Restore a product to one side of a historical change.", "path: productId; body: {changeId,side}."),
  tool("admin_product_bulk_undo_preview", "catalog", "POST", "/products/admin/changes/bulk-undo/preview", "write", "Preview a bounded bulk product-change rollback.", "body: selected change IDs or bounded filters."),
  tool("admin_product_bulk_undo", "catalog", "POST", "/products/admin/changes/bulk-undo", "destructive", "Apply an approved bounded bulk product-change rollback.", "body: preview token and exact rollback selection."),
  tool("admin_product_listing_update", "catalog", "PATCH", "/products/admin/listings/:listingId", "write", "Change a seller listing's administrative status.", "path: listingId; body: {status}."),
  tool("admin_product_offer_update", "catalog", "PATCH", "/products/admin/offers/:offerId", "write", "Update an offer's platform-managed price, currency, stock, or status fields.", "path: offerId; body: allowlisted offer fields."),
  tool("admin_product_category_update", "catalog", "PATCH", "/products/admin/categories/:categoryId", "write", "Update a product category and its localized labels.", "path: categoryId; body: allowlisted category fields and translations."),
  tool("admin_product_image_upload", "catalog", "POST", "/products/admin/:productId/image", "write", "Upload and replace a product image selected locally in the browser.", "path: productId; body: {file:{\"$fileInput\":{\"label\":\"Product image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}}."),
  tool("admin_product_image_remove", "catalog", "DELETE", "/products/admin/:productId/image", "destructive", "Remove a product image and its generated variants.", "path: productId."),
  tool("seller_products_list", "catalog", "GET", "/products/mine", "read", "List products and offers for the current seller context.", "query: status, search, cursor, limit; requires seller authorization."),
  tool("seller_product_create", "catalog", "POST", "/products", "write", "Create a product in the current seller context.", "body: validated product, variants, listings and initial offer fields."),
  tool("seller_product_update", "catalog", "PATCH", "/products/:productId", "write", "Update a seller-owned product.", "path: productId; body: allowlisted seller-editable fields."),
  tool("seller_product_image_upload", "catalog", "POST", "/products/:productId/image", "write", "Upload an image for a seller-owned product from the browser.", "path: productId; body: {file:{\"$fileInput\":{\"label\":\"Product image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":5242880}}}."),
  tool("seller_product_image_remove", "catalog", "DELETE", "/products/:productId/image", "destructive", "Remove the image from a seller-owned product.", "path: productId."),
  tool("seller_product_offer_create", "catalog", "POST", "/products/:productId/offers", "write", "Create an offer on a seller-owned product.", "path: productId; body: validated variant, price, stock or delivery fields."),
  tool("seller_product_offer_update", "catalog", "PATCH", "/products/offers/:offerId", "write", "Update a seller-owned offer.", "path: offerId; body: allowlisted offer fields."),

  tool("admin_orders_list", "orders", "GET", "/orders", "read", "Search and paginate orders visible to the authenticated admin.", "query: status, sellerId, search, cursor, limit."),
  tool("admin_orders_new_count", "orders", "GET", "/orders/new-count", "read", "Count new orders since the admin's last seen timestamp."),
  tool("admin_orders_mark_seen", "orders", "POST", "/orders/seen", "write", "Advance the current actor's order-seen timestamp."),
  tool("admin_order_get", "orders", "GET", "/orders/admin/:id", "read", "Read comprehensive administrative order details.", "path: id."),
  tool("order_get", "orders", "GET", "/orders/:id", "read", "Read one order through the current actor's buyer or seller scope.", "path: id."),
  tool("order_create", "orders", "POST", "/orders", "critical", "Create an order through the authenticated actor's supported legacy order flow.", "body: validated authoritative offer and fulfillment inputs.", true),
  tool("admin_order_status", "orders", "PATCH", "/orders/:id/status", "critical", "Perform an authorized order status transition.", "path: id; body: {status}; transition rules remain enforced.", true),
  tool("admin_order_shipping_update", "orders", "PATCH", "/orders/:id/shipping", "write", "Update an order's shipping address or shipment metadata.", "path: id; body: validated shipping fields."),
  tool("admin_order_shipping_register", "orders", "POST", "/orders/:id/shipping/register", "critical", "Register a shipment with the configured provider.", "path: id; body: provider shipment fields.", true),
  tool("admin_order_shipping_register_legacy", "orders", "POST", "/orders/:id/shipping/amadast", "critical", "Register a shipment through the legacy Amadast-compatible route.", "path: id; body: provider shipment fields.", true),
  tool("admin_order_shipping_sync", "orders", "POST", "/orders/:id/shipping/sync", "write", "Synchronize an order shipment with its provider.", "path: id."),
  tool("admin_order_shipping_sync_legacy", "orders", "POST", "/orders/:id/shipping/amadast/sync", "write", "Synchronize a shipment through the legacy Amadast-compatible route.", "path: id."),
  tool("order_item_download", "orders", "GET", "/orders/:orderId/items/:itemId/download", "read", "Download an authorized digital order item to the owner's browser.", "path: orderId and itemId; query: fileIndex when selecting among multiple files.", false, "download"),
  tool("orders_leaderboard", "orders", "GET", "/orders/leaderboard", "read", "Read the order leaderboard available to the authenticated actor.", "query: supported date and limit filters."),

  tool("payouts_list", "payouts", "GET", "/payouts", "read", "List payout ledger entries visible to the authenticated actor.", "query: status, cursor, limit."),
  tool("payout_get", "payouts", "GET", "/payouts/:id", "read", "Read one payout ledger entry.", "path: id."),
  tool("payout_request", "payouts", "POST", "/payouts/requests", "critical", "Create a payout request from authoritative payable balances.", "body: validated payout request fields.", true),
  tool("payout_transition", "payouts", "PATCH", "/payouts/requests/:id", "critical", "Perform an authorized payout state transition.", "path: id; body: transition and provider reference fields.", true),

  tool("admin_payment_methods", "payments", "GET", "/payments/admin/methods", "read", "List payment method configurations without secrets."),
  tool("admin_payment_method_update", "payments", "PATCH", "/payments/admin/methods/:providerCode", "critical", "Update a payment method, seller rules, product rules, and encrypted credentials.", "path: providerCode; body: validated method configuration."),
  tool("admin_payment_sellers", "payments", "GET", "/payments/admin/seller-options", "read", "Search sellers for payment-routing configuration.", "query: search, cursor, limit."),
  tool("admin_payment_transactions", "payments", "GET", "/payments/admin/transactions", "read", "Search and paginate payment attempts.", "query: provider, status, search, dates, cursor, limit."),
  tool("admin_payment_refund", "payments", "POST", "/payments/admin/:attemptId/refund", "critical", "Request a bounded, idempotent payment refund.", "path: attemptId; body: amount and reason when supported.", true),
  tool("payment_initiate", "payments", "POST", "/payments/:providerCode", "critical", "Initiate payment for an authorized order using a selected provider.", "path: providerCode; body: orderId and validated return context.", true),
  tool("local_payment_get", "payments", "GET", "/payments/local/:authority", "read", "Read an authenticated local test-payment attempt.", "path: authority."),
  tool("local_payment_complete", "payments", "POST", "/payments/local/:authority/complete", "critical", "Complete or cancel an authenticated local test payment.", "path: authority; body: {status}."),

  tool("admin_blog_posts", "blog", "GET", "/blog/manage/posts", "read", "Search and paginate managed blog posts.", "query: status, sellerId, search, cursor, limit."),
  tool("admin_blog_create", "blog", "POST", "/blog/manage/posts", "write", "Create a blog draft."),
  tool("admin_blog_get", "blog", "GET", "/blog/manage/posts/:id", "read", "Read a complete managed blog post.", "path: id."),
  tool("admin_blog_update", "blog", "PATCH", "/blog/manage/posts/:id", "write", "Update a blog draft and its localized content.", "path: id; body: revision, translations, taxonomy, relations and media references."),
  tool("admin_blog_submit", "blog", "POST", "/blog/manage/posts/:id/submit", "write", "Submit a seller-authored blog draft for review.", "path: id."),
  tool("admin_blog_publish", "blog", "POST", "/blog/manage/posts/:id/publish", "write", "Publish a reviewed blog revision.", "path: id; body: optimistic version where required."),
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
  tool("admin_blog_category_create", "blog", "POST", "/blog/manage/categories", "write", "Create a localized blog category.", "body: {translations:[{locale,name,slug}]}"),
  tool("admin_blog_category_update", "blog", "PATCH", "/blog/manage/categories/:id", "write", "Update a localized blog category.", "path: id; body: translations."),
  tool("admin_blog_category_delete", "blog", "DELETE", "/blog/manage/categories/:id", "destructive", "Delete an unused blog category.", "path: id."),
  tool("admin_blog_tag_create", "blog", "POST", "/blog/manage/tags", "write", "Create a localized blog tag.", "body: {translations:[{locale,name,slug}]}"),
  tool("admin_blog_tag_update", "blog", "PATCH", "/blog/manage/tags/:id", "write", "Update a localized blog tag.", "path: id; body: translations."),
  tool("admin_blog_tag_delete", "blog", "DELETE", "/blog/manage/tags/:id", "destructive", "Delete an unused blog tag.", "path: id."),
  tool("admin_blog_media_upload", "blog", "POST", "/blog/media", "write", "Upload blog media selected locally in the browser.", "body: kind, postId when applicable, and file:{\"$fileInput\":{\"label\":\"Blog image\",\"accept\":\"image/jpeg,image/png,image/webp\",\"maxBytes\":8388608}}."),

  tool("admin_coupons_list", "coupons", "GET", "/coupons/admin", "read", "Search and paginate coupons across sellers.", "query: sellerId, active, search, cursor, limit."),
  tool("admin_coupon_create", "coupons", "POST", "/coupons/admin", "write", "Create a coupon for a selected seller.", "body: sellerId, code, discount, currency, limits and validity window."),
  tool("admin_coupon_update", "coupons", "PATCH", "/coupons/admin/:id", "write", "Update a seller coupon.", "path: id; body: allowlisted coupon fields."),
  tool("admin_coupon_delete", "coupons", "DELETE", "/coupons/admin/:id", "destructive", "Delete a seller coupon.", "path: id."),
  tool("seller_coupons_list", "coupons", "GET", "/coupons/mine", "read", "List coupons for the current seller context.", "query: cursor, limit."),
  tool("seller_coupon_create", "coupons", "POST", "/coupons", "write", "Create a coupon for the current seller context.", "body: code, discount, currency, limits and validity window."),

  tool("admin_comments_list", "comments", "GET", "/admin/settings/comments", "read", "Search and paginate comments for moderation.", "query: status, target, search, locale, cursor, limit."),
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
  tool("admin_bridge_refunds", "bridge", "GET", "/bridge/admin/refund-requests", "read", "List bridge fulfillment refund requests."),
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
  tool("seller_bridge_order_retry", "bridge", "POST", "/bridge/orders/:id/retry", "write", "Retry a failed bridge fulfillment.", "path: id."),
  tool("bridge_refund_request", "bridge", "POST", "/bridge/orders/:id/refund-request", "critical", "Request a refund for an authorized bridge fulfillment.", "path: id; body: reason."),

  tool("admin_uploads_list", "uploads", "GET", "/admin/uploads", "read", "Search and paginate uploaded media assets.", "query: source, state, search, cursor, limit."),
  tool("admin_uploads_summary", "uploads", "GET", "/admin/uploads/summary", "read", "Read aggregate upload storage and state totals."),
  tool("admin_upload_get", "uploads", "GET", "/admin/uploads/:source/:id", "read", "Read one upload's metadata and safe preview link.", "path: source and id."),
  tool("admin_uploads_trash", "uploads", "POST", "/admin/uploads/trash", "destructive", "Move a bounded selection of media assets to trash.", "body: {items:[{source,id}],reason}."),
  tool("admin_uploads_restore", "uploads", "POST", "/admin/uploads/restore", "write", "Restore a bounded selection of trashed media assets.", "body: {items:[{source,id}]}"),

  tool("admin_notice_get", "settings", "GET", "/admin/settings/notice", "read", "Read the platform notice settings."),
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
  tool("admin_sms_settings_update", "settings", "PATCH", "/admin/settings/sms", "critical", "Update SMS provider settings and encrypted credentials.", "body: provider configuration; omit unchanged secrets."),
  tool("admin_goghdi_settings", "settings", "GET", "/admin/settings/goghdi", "read", "Read Goghdi integration settings with credentials redacted."),
  tool("admin_goghdi_settings_update", "settings", "PATCH", "/admin/settings/goghdi", "critical", "Update Goghdi integration settings and encrypted credentials.", "body: validated connection configuration; omit unchanged secrets."),
  tool("admin_shipping_settings", "settings", "GET", "/admin/settings/shipping", "read", "Read global shipping settings with secrets redacted."),
  tool("admin_shipping_settings_update", "settings", "PATCH", "/admin/settings/shipping", "critical", "Update global shipping provider settings and credentials.", "body: validated shipping configuration."),
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
  tool("admin_backup_run_create", "backup", "POST", "/admin/backups/runs", "critical", "Queue a manual backup run.", "body: {components:[...]}."),
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
    return ADMIN_TOOL_CATALOG.map((entry) => ({ ...entry, requiresApproval: true }));
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
        examples: entries.slice(0, 6).map((entry) => ({ name: entry.name, description: entry.description }))
      }));
  }

  search(query = "", domain?: string, limit = 40) {
    const normalizedQuery = query.trim().toLowerCase().slice(0, 200);
    const tokens = normalizedQuery.split(/[^\p{L}\p{N}_-]+/u).filter((token) => token.length >= 2).slice(0, 12);
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return ADMIN_TOOL_CATALOG
      .filter((entry) => !domain || entry.domain === domain)
      .map((entry) => {
        const haystack = `${entry.name} ${entry.domain} ${entry.method} ${entry.path} ${entry.description} ${entry.inputHint}`.toLowerCase();
        const score = (normalizedQuery && haystack.includes(normalizedQuery) ? 20 : 0) + tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 3 : 0), 0);
        return { entry, score };
      })
      .filter(({ score }) => !normalizedQuery || score > 0)
      .sort((left, right) => right.score - left.score || left.entry.name.localeCompare(right.entry.name))
      .slice(0, boundedLimit)
      .map(({ entry }) => ({ ...entry, requiresApproval: true }));
  }

  compactPrompt(query: string) {
    const shortlist = this.search(query, undefined, 30);
    return `Domains: ${this.domainSummary()}\nLikely tools for the current request:\n${shortlist.map((entry) => `- ${entry.name} [${entry.risk}] ${entry.method} ${entry.path}: ${entry.description} Input: ${entry.inputHint}`).join("\n") || "- No lexical match. Use tool discovery with English keywords."}`;
  }

  has(name: string): boolean {
    return this.byName.has(name);
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
      ...(input.body !== undefined ? { body: input.body } : {}),
      risk: definition.risk,
      description: definition.description,
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
    if (Object.keys(raw).some((key) => !["path", "query", "body"].includes(key))) throw new BadRequestException("Admin AI tool input contains an unsupported field");
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
    return { ...(Object.keys(normalizedPath).length ? { path: normalizedPath } : {}), ...(Object.keys(normalizedQuery).length ? { query: normalizedQuery } : {}), ...(raw.body !== undefined ? { body: raw.body as AdminToolJson } : {}) };
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
