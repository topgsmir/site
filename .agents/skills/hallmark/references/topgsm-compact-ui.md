# TopGSM compact UI guidelines

Apply to new and changed TopGSM UI, including admin, seller, account, storefront,
forms, dialogs, and feature pages. The default is compact and easy to scan, with
minimal unnecessary scrolling. An explicit user brief can call for a more
spacious treatment. Keep changes within the requested feature scope.

## Layout priorities

- At a 1366 x 768 CSS-pixel desktop viewport and 100% zoom, aim to show the page
  title, primary action, essential filters or inputs, and meaningful content
  without scrolling. Include the actual app header and navigation in this budget.
  A listing should normally show its column headings and at least five ordinary
  rows; a dashboard should show useful data, not only introductions and metrics.
- Use one compact page header with the title and actions aligned together where
  space permits. Keep descriptions to one short sentence when needed. Avoid
  decorative hero banners, giant icons, repeated headings, and tall welcome blocks
  on functional pages.
- Use available desktop width for related form fields, summaries, and details.
  Prefer two columns for short related inputs, while keeping reading order logical
  and long text fields wide. Stack naturally on small screens.
- Present repeated records as compact tables or lists when that makes comparison
  easier. Avoid a large card per simple record or nested cards that multiply padding.
  Keep summary metrics in a short row instead of stacked oversized tiles.
- Preserve the established shell and component patterns across feature pages.
  Do not change layout just to achieve visual variety.

## Sizing defaults

Use the nearest existing spacing and typography tokens in `apps/web/tokens.css`.
These are defaults for ordinary feature UI, not fixed heights that may clip text.

| Element | Default |
| --- | --- |
| Page padding | 16–24px desktop; 12–16px mobile |
| Gap between major groups | 16–24px |
| Panel padding and layout gaps | 12–16px |
| Related controls, label-to-field gaps | 4–8px |
| Page title | 20–24px, with natural line height |
| Section title | 16–18px |
| Body, field labels, table content | 14–16px; retain comfortable Persian line height |
| Secondary metadata | 12–13px; never use this size for primary content |
| Desktop inputs and buttons | Typically 36–40px minimum height, expanding for content |
| Ordinary table rows | Typically 40–48px, expanding for wrapped content |

Avoid routine 32–48px panel padding, 48px+ feature headings, large minimum-height
cards, and viewport-height sections. Reduce structural whitespace before reducing
type size. Preserve the existing brand, font stack, and semantic colour tokens.

## Disclosure and scrolling

- Keep frequently used actions, search, and essential filters visible. Put advanced
  filters and rarely used options behind clearly labelled disclosure controls;
  show applied filter counts or chips even when the panel is collapsed.
- Use tabs for separate tasks and collapsible sections for optional detail. Do not
  hide required fields, validation errors, critical status, prices, or the primary
  action solely to meet a height target. Reveal and focus invalid collapsed fields.
- Use compact inline empty/loading/error states within the relevant content area.
  Avoid large illustrations and instructional blocks that push the task downscreen.
- Let long lists and complex forms scroll naturally. Use existing pagination or
  virtualization patterns when appropriate. Prefer a single main scroll area;
  bounded dialog or table scrolling must retain usable keyboard and touch access.
- Sticky actions are useful for long forms only when they do not cover content or
  focused controls. Do not force everything into one screen with fixed heights,
  CSS zoom, transforms, hidden overflow, or indiscriminate truncation.

## Readability and verification

- Keep visible labels, focus rings, adequate contrast, and full access to long
  values. On touch layouts, aim for at least 44 x 44px interactive hit areas;
  compact visual styling must not make targets difficult to activate.
- Check changed screens at 1366 x 768 and 1440 x 900 on desktop, plus 375px and
  320px widths on mobile. Check text reflow at 200% browser zoom. Mobile may scroll
  vertically; keep the main task first and avoid page-level horizontal overflow.
- Exercise realistic Persian/RTL content, long labels, populated lists, empty and
  error states. At desktop size, verify where the first useful row or input begins
  and how many rows fit. If introductory chrome consumes most of the viewport,
  reduce it before handoff.
- Fix overflow at its source. Do not apply blanket `overflow-x: clip` or `hidden`
  to conceal inaccessible content. Wide data tables may have a clearly contained
  horizontal scroll region when a responsive representation loses needed context.
- Report the viewport checks actually performed and any limitations. These checks
  apply when implementing UI; instruction-only changes need reference and diff
  validation, not a fabricated visual verification.
