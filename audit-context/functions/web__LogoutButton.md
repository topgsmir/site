## `LogoutButton` in apps/web/src/components/auth/LogoutButton.tsx (L9-L47)

**Purpose:** Renders a reusable localized logout control with pending and error states for privileged pages (L9-L47).

---

**Inputs & Assumptions:**
- `locale` (`Locale`): validated by the enclosing localized page (`admin/page.tsx:L23-L29`; seller page L23-L29).
- Implicit: router, shared API client, and authentication cookie (L4, L7, L10-L12).

---

**Outputs & Effects:**
- Renders a disabled-while-pending button and alert text on failure (L28-L45).
- Click starts `logout` without awaiting it in the event wrapper (L33).

---

**Block-by-Block:**

```tsx
// L10-L12
const router = useRouter();
const [isLoggingOut, setIsLoggingOut] = useState(false);
const [error, setError] = useState("");
```
- **What:** Creates navigation and local request state.
- **Why here:** Handler and rendered affordances share these values.
- **Assumes:** component remains mounted through request completion; otherwise React/router lifecycle decides effects.
- **Establishes:** initial control is enabled with no error.
- **Depended on by:** `logout` and button rendering.

```tsx
// L28-L45
<button ... onClick={() => void logout()} disabled={isLoggingOut}>...</button>
{error ? <span ... role="alert">{error}</span> : null}
```
- **What:** Connects the asynchronous operation to accessible pending/error UI.
- **Why here:** Disabling prevents additional user clicks after pending state renders.
- **Assumes:** no second click occurs before React commits `isLoggingOut`; synchronous handler-level re-entry guard: nothing found.
- **Establishes:** rendered pending state disables the button.
- **Depended on by:** admin/seller page session exit flow.

---

**Cross-Function Dependencies:**
- Callee `logout` (internal callback, L14-L26).
- Callers: `VendorManagement` (L464) and `SellerDashboardPage` (L35).
- Shared state: cookie/session state with the API and protected server pages.
- Invariant coupling: locale controls both copy and post-logout route.

---

**Open Questions:**
- No open questions.
