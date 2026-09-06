## `LoginForm` in apps/web/src/app/[locale]/login/LoginForm.tsx (L66-L202)

**Purpose:** Renders the localized login/registration client boundary and coordinates authentication request, feedback, and post-authentication navigation (L66-L202).

---

**Inputs & Assumptions:**
- `locale` (`Locale`) and `copy` (`AuthCopy`): server-supplied after locale validation (`login/page.tsx:L16-L24`). Trust: trusted application data.
- `nextPath` (`string | undefined`): untrusted query input forwarded unchanged by `LoginPage` (`login/page.tsx:L11-L24`).
- Implicit: React state, browser forms/cookies, public API URL, and router (L9-L10, L67-L70).
- Precondition: `copy` contains every mode label. Established by the `AuthCopy` prop type and caller dictionary at compile time; runtime validation: nothing found.

---

**Outputs & Effects:**
- Renders mode-dependent inputs with native length/type/required constraints (L139-L174).
- Disables submit while a request is in progress and exposes errors as an alert (L176-L184).
- `submit` performs credentialed login/registration and navigation (L72-L116).
- `switchMode` toggles request shape and visible fields (L118-L121, L139-L190).

---

**Block-by-Block:**

```tsx
// L67-L70
const router = useRouter();
const [isRegistering, setIsRegistering] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState("");
```
- **What:** Initializes navigation and the authentication UI state machine.
- **Why here:** All later handlers and render branches depend on these values.
- **Assumes:** one in-flight request is enough state for this form instance.
- **Establishes:** initial mode is login, idle, with no error.
- **Depended on by:** L72-L121 and L129-L190.

```tsx
// L139-L184
<form ... onSubmit={submit}>...mode-dependent inputs...{error ? ... : null}<button type="submit" disabled={isSubmitting}>...</button></form>
```
- **What:** Defines the user-input boundary and feedback affordances.
- **Why here:** Native validation precedes the JavaScript submit callback for normal user submission.
- **Assumes:** client attributes and API validation describe compatible constraints. API DTOs provide the authoritative runtime checks; the client alone does not establish them.
- **Establishes:** normal browser submissions include the currently rendered required fields.
- **Depended on by:** `submit`'s `FormData` reads.

---

**Cross-Function Dependencies:**
- Callee `submit` (internal callback): records the network/session/navigation flow (L72-L116).
- Callee `switchMode` (internal callback): changes rendered/request mode (L118-L121).
- Callee `destinationFor` (via `submit`): constrains continuation and maps role fallbacks (L42-L64, L107).
- Caller: `LoginPage` (login page `L22-L24`).
- Shared state: session cookie with API/auth server helpers; query continuation with `LoginPage`.
- Invariant coupling: protected pages do not rely only on this component's returned `AuthUser`; they re-evaluate identity through `requireUser`.

---

**Open Questions:**
- unclear; need browser interaction tests for repeated submit and mode-switch behavior during an in-flight request.
