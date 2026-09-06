## `LoginPage` in apps/web/src/app/[locale]/login/page.tsx (L16-L26)

**Purpose:** Validates the login route locale and passes localized auth copy plus the query-string continuation target to the client form.

---

**Inputs & Assumptions:**
- `params.locale` (`string`): untrusted URL segment (L16-L17).
- `searchParams.next` (`string | undefined`): untrusted query value (L11-L16, L23).
- Precondition: dictionary `auth` subtree matches `LoginForm` copy needs. Established through current TypeScript inference at L22 and component prop use.

---

**Outputs & Effects:**
- Calls `notFound` on unsupported locale (L17).
- Returns `LoginForm` with supported locale, localized auth dictionary, and unmodified `nextPath` (L19-L24).
- No direct network or storage effects.

---

**Block-by-Block:**

```tsx
// L17-L24
if (!isLocale(params.locale)) notFound();
return <LoginForm locale={params.locale} copy={getDictionary(params.locale).auth} nextPath={searchParams.next} />;
```
- **What:** Narrows locale and bridges server route inputs into a client component.
- **Why here:** The client receives only a supported locale but is responsible for validating `nextPath`.
- **Assumes:** `notFound` terminates.
- **Establishes:** `locale` is supported; no trust is established for `nextPath`.
- **Depended on by:** `destinationFor` during successful login (`LoginForm.tsx:L107`).

---

**Cross-Function Dependencies:**
- Callee `isLocale`, `getDictionary`, `notFound`, `LoginForm`.
- Caller: Next.js localized login route.
- Shared state: none here.
- Invariant couplings: redirect target validation resides in `destinationFor`, not this server page (`LoginForm.tsx:L42-L64`).

---

**Open Questions:**
- No open questions.

