# SEO Review Checklist

Apply relevant checks; mark non-applicable items explicitly during a formal audit.

## Indexation and URLs

- [ ] The route has an explicit indexation class.
- [ ] Indexable content returns `200`; missing entities return `404`; moves use the intended permanent redirect.
- [ ] The canonical is absolute, self-referencing, and uses the production host.
- [ ] HTTP/HTTPS, host, locale, casing, slash, and slug variants converge without chains.
- [ ] Private, thin, duplicate, and internal-search pages are noindex and absent from the sitemap.
- [ ] Query parameters cannot create an unlimited crawl space.

## Localization

- [ ] `<html lang>` and `dir` match the locale.
- [ ] Hreflang targets exist, are equivalent, and are reciprocal.
- [ ] `x-default` points to a sensible default destination.
- [ ] Title, description, headings, body copy, and alt text are genuinely localized.
- [ ] Persian/Arabic text is valid UTF-8 and not mojibake.

## Rendered content

- [ ] The initial server-rendered HTML contains the primary content.
- [ ] Exactly one visible, descriptive `h1` identifies the subject.
- [ ] Heading order, landmarks, lists, tables, and links use semantic HTML.
- [ ] Critical information is not present only in images or client-only UI.
- [ ] Links have real `href` values and descriptive anchor text.
- [ ] Images have useful alt text or empty alt text when decorative.
- [ ] Content answers the target task without stuffing, duplication, or unsupported claims.

## Metadata and sharing

- [ ] Title and description are unique and agree with visible content.
- [ ] Canonical and hreflang values use normalized URLs.
- [ ] Open Graph/Twitter values match the page and use suitable media when available.
- [ ] Robots metadata matches the route classification.
- [ ] Metadata does not rely on placeholders or stale fallback facts.

## Structured data

- [ ] Schema type is eligible for the visible page.
- [ ] URLs and `@id` values are absolute and stable.
- [ ] Price, currency, availability, rating, dates, author, and images match authoritative data.
- [ ] Breadcrumbs and item lists match visible navigation/content.
- [ ] JSON-LD is safely serialized and parses as JSON.
- [ ] Rich-results validation reports no blocking errors.

## Discovery

- [ ] Sitemap contains only canonical, indexable URLs.
- [ ] Sitemap alternate-language entries point to real equivalent pages.
- [ ] `lastModified` represents a real content change rather than request time.
- [ ] Robots rules use correct route patterns and advertise the production sitemap.
- [ ] The page is reachable through useful internal links, not only the sitemap.

## Quality, performance, and accessibility

- [ ] Primary content works without client effects, animation, or socket data.
- [ ] Images have dimensions and appropriate loading/priority behavior.
- [ ] Fonts and above-the-fold assets do not create avoidable render delay or layout shift.
- [ ] Third-party scripts and widgets are deferred when non-critical.
- [ ] Mobile layout, keyboard navigation, focus, labels, contrast, and reduced motion work.
- [ ] No new hydration, console, type-check, or production-build errors appear.

## Evidence to report

- [ ] List routes/files inspected.
- [ ] Record commands and rendered-output checks performed.
- [ ] Distinguish confirmed issues from recommendations.
- [ ] Identify validation that requires a deployed URL, analytics, Search Console, or field performance data.
