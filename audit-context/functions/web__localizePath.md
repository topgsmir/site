## `localizePath` in apps/web/src/lib/i18n/locales.ts (L14-L17)

**Purpose:** Prefixes an application path with a supported locale while normalizing its leading slash.

---

**Inputs & Assumptions:**
- `locale` (`Locale`): trusted supported locale.
- `path` (`string`, default `/`): internal path or fragment; trust: semi-trusted by caller (L14-L16).
- Precondition: `path` is intended as a path, not an absolute URL. Established by: nothing found in this helper.

---

**Outputs & Effects:**
- Returns `/{locale}` for root and `/{locale}/{path}` otherwise (L15-L16).
- No state changes.

---

**Block-by-Block:**

```ts
// L15-L16
const normalizedPath = path.startsWith("/") ? path : `/${path}`;
return `/${locale}${normalizedPath === "/" ? "" : normalizedPath}`;
```
- **What:** Adds a slash when absent and prefixes locale.
- **Why here:** Avoids duplicated path formatting across metadata and links.
- **Assumes:** callers do not pass an already-localized path when double-prefixing is undesired. Established by current constant callers; nothing found generically.
- **Establishes:** result begins with exactly the supplied locale prefix.
- **Depended on by:** home metadata, `LandingPage` links, and `LanguageSwitcher`.

---

**Cross-Function Dependencies:**
- No callees.
- Callers: home `generateMetadata` (`page.tsx:L66`, L76-L79); landing helpers/components (`LandingPage.tsx:L279-L287`, L306).
- Shared state: none.
- Invariant couplings: route generation relies on callers supplying validated `Locale` values.

---

**Open Questions:**
- No open questions.

