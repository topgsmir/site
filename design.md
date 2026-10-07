# TopGSM customer design

The customer experience follows the owner's colorful admin-panel reference
(7 October 2026): navy chrome, blue actions, teal and pink feature accents,
soft tinted panels, compact spacing, and rounded icon tiles.

## Shared system

- Source of truth: `apps/web/tokens.css`. Customer colors use the
  `--color-customer-*` tokens. Keep the existing Outfit/Vazirmatn font stack,
  spacing scale, focus treatment, and light/dark support.
- The owner's explicit request for colorful pages overrides the older brand
  reference's limits on decorative teal/pink and tinted surfaces. Decorative
  colors have separate tokens from success/error states. Errors, warnings,
  payment status, and validation retain their semantic colors and text labels.
- Navy anchors navigation and selected feature panels. Blue is the main action.
  Teal identifies services/support; pink identifies community/account content.
  Use readable dark ink on saturated icon tiles and theme-aware ink on tints.
- Use the existing page structures: compact discovery on the homepage, filters
  above catalog results, purchase controls beside product details, short account
  headers above task content, and readable article columns.
- Keep rounded panels and restrained shadows. Avoid oversized introductions,
  decorative animation, or additional scrolling just to show more color.
- Preserve routes, copy, authorization, checkout behavior, and component ownership.

## Coverage

Home and expert directory; catalog and product detail; cart, payment status,
local gateway and buyer order detail; sign-in; account overview, orders,
settings, wallet, club and leaderboard; journal index, categories, tags,
seller archives and articles; contact, expert profile, loading, maintenance and
public error states.

## Implementation

Customer CSS modules consume shared tokens directly. Shared order-detail styles
are scoped to a buyer class so seller/admin workspaces retain their styling.
The token source is the CSS export; do not duplicate it into another token file.
Verify Persian RTL and English LTR, both themes, keyboard focus, reduced motion,
desktop viewports and narrow phones. Fix overflow at its source.
