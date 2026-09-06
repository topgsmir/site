## `LoginForm.submit` in apps/web/src/app/[locale]/login/LoginForm.tsx (L72-L116)

**Purpose:** Converts the active login/registration form into an API request, accepts an authenticated user response, and navigates to a role-aware destination (L72-L116).

---

**Inputs & Assumptions:**
- `event` (`FormEvent<HTMLFormElement>`): browser form submission containing user-entered identity and password fields. Trust: untrusted (L72-L84, L139-L174).
- Implicit: `isRegistering`, `locale`, `nextPath`, localized copy, `API_BASE`, browser cookies, and Next router (L66-L70, L86-L114).
- Precondition: browser constraint validation has run for a user-triggered submit. Established by native form/input attributes (L139-L174); direct programmatic calls: nothing found.
- Precondition: a successful API response's `user` matches `AuthUser`. Runtime establishment in this function: nothing found; it is a TypeScript cast at L96-L98.

---

**Outputs & Effects:**
- Prevents native form submission and sets submitting/error state (L73-L75).
- Sends entered account data to the register or login endpoint as JSON, with credentials enabled (L77-L95).
- On an OK response with a truthy `user`, pushes a role/continuation-derived route and refreshes router data (L100-L108).
- On failure, renders either the response-provided message or generic copy (L100-L112).
- Always clears submitting state (L113-L115).

---

**Block-by-Block:**

```tsx
// L73-L84
event.preventDefault();
setIsSubmitting(true);
setError("");
const form = new FormData(event.currentTarget);
const payload = { ...mode-dependent fields..., password: String(form.get("password") ?? "") };
```
- **What:** Captures fields and builds one of two request shapes.
- **Why here:** The request mode and payload are fixed before asynchronous work.
- **Assumes:** the rendered field names correspond to the captured `isRegistering` value. Established by conditional input names at L140-L172.
- **Establishes:** payload strings exist even when fields are absent.
- **Depended on by:** request serialization at L93.

```tsx
// L86-L98
const response = await fetch(`${API_BASE}/auth/${isRegistering ? "register" : "login"}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
const data = (await response.json().catch(() => null)) as ...;
```
- **What:** Performs credentialed authentication/registration and best-effort JSON decoding.
- **Why here:** Response status and body are evaluated together in the next block.
- **Assumes:** `API_BASE` identifies the intended API; deployment configuration establishes this, but no validation is present here (L9-L10).
- **Establishes:** `data` is null on JSON parse rejection; its runtime shape otherwise remains unchecked.
- **Depended on by:** success/failure branching at L100.

```tsx
// L100-L108
if (!response.ok || !data?.user) { ... throw new Error(...); }
router.push(destinationFor(data.user, locale, nextPath) as Route);
router.refresh();
```
- **What:** Rejects failed/missing-user responses and navigates accepted responses.
- **Why here:** Navigation occurs only after both an OK status and truthy `user`.
- **Assumes:** the response message is appropriate for direct display; established by API response contract: nothing found in this client.
- **Establishes:** `destinationFor` receives a truthy object typed as `AuthUser`, not a runtime-validated one.
- **Depended on by:** protected destination pages, which independently call `requireUser` (`admin/page.tsx:L29`; seller page L29).

```tsx
// L109-L115
catch (requestError) { setError(requestError instanceof Error ? requestError.message : copy.genericError); }
finally { setIsSubmitting(false); }
```
- **What:** Surfaces errors and restores submission readiness.
- **Why here:** One cleanup path covers transport, parsing, API, and navigation exceptions.
- **Assumes:** all `Error.message` values are suitable UI text; established by: nothing found.
- **Establishes:** submitting state eventually returns to false after the awaited flow settles.
- **Depended on by:** submit-button disabled/copy state (L178-L184).

---

**Cross-Function Dependencies:**
- Callee `fetch` to `/auth/login` or `/auth/register` (external-source-available API): API DTO validation, credential checks/account creation, and session cookie creation are recorded in `api__auth-controller__login.md`, `api__auth-controller__register.md`, and related auth-service records.
- Callee `destinationFor` (internal): filters localized continuation and maps role fallback (`L42-L64`).
- Callees router `push`/`refresh` (external framework): initiate client navigation and server-data refresh (L107-L108).
- Caller: auth form `onSubmit` (L139).
- Shared state: authentication cookie written by API response; component submitting/error state; server session lookup on destination pages.
- Invariant coupling: client routing uses the returned role, while privileged pages independently authorize via `/auth/me`.

---

**Open Questions:**
- unclear; need deployment configuration to establish the concrete public API origin and browser cookie/CORS relationship.
- unclear; need product requirements to determine which API messages are intended for direct display.
