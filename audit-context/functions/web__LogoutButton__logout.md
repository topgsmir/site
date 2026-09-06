## `LogoutButton.logout` in apps/web/src/components/auth/LogoutButton.tsx (L14-L26)

**Purpose:** Requests session termination, redirects to localized login on success, and reports failure while keeping the user on the current page (L14-L26).

---

**Inputs & Assumptions:**
- Implicit: locale prop, shared credentialed Axios client, router, and component state (L9-L12).
- Precondition: request cookies are attached to the configured API origin. Established by `api` client `withCredentials: true` (`client.ts:L5-L8`) subject to browser/deployment policy.

---

**Outputs & Effects:**
- Sets pending state and clears prior error (L15-L16).
- Sends `POST /auth/logout`; on success replaces history with login and refreshes server data (L18-L21).
- On rejection, sets localized error and re-enables the control (L22-L25).

---

**Block-by-Block:**

```tsx
// L15-L21
setIsLoggingOut(true);
setError("");
await api.post("/auth/logout");
router.replace(`/${locale}/login`);
router.refresh();
```
- **What:** Starts pending UI, requests cookie clearing, then navigates.
- **Why here:** Navigation waits for successful API completion.
- **Assumes:** a resolved request means the session cookie is cleared. Established by the logout controller response path (`apps/api/src/modules/auth/auth.controller.ts:L60-L65`).
- **Establishes:** successful client flow targets localized login.
- **Depended on by:** subsequent server-rendered authentication state.

```tsx
// L22-L25
catch { setError(t(locale, "auth.logoutError")); setIsLoggingOut(false); }
```
- **What:** Restores interactivity and reports a generic localized failure.
- **Why here:** Only rejected API/navigation operations take this path.
- **Assumes:** retry from the current page is acceptable.
- **Establishes:** pending state is false on caught failure.
- **Depended on by:** disabled button and alert rendering (L34, L44).

---

**Cross-Function Dependencies:**
- Callee shared `api.post` (external Axios plus source-visible configuration): uses `API_BASE` and credentials (`client.ts:L3-L8`).
- Callee `/auth/logout` (external-source-available API): clears the named cookie through controller helpers (`auth.controller.ts:L60-L65`, L77-L99).
- Callers: button click wrapper (L33); component is mounted on admin and seller dashboards (`admin` through `VendorManagement.tsx:L464`; seller page L35).
- Shared state: browser authentication cookie and route cache.
- Invariant coupling: route refresh causes protected server pages to observe post-logout session state.

---

**Open Questions:**
- unclear; need deployment cookie/CORS configuration to establish cross-origin logout behavior.
