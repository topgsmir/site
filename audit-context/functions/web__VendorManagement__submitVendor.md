## `VendorManagement.submitVendor` in apps/web/src/components/admin/VendorManagement.tsx (L447-L481)

**Purpose:** Converts editable vendor state to the API contract, creates or updates persistent vendor/account/permission data, and reconciles the returned projection into the displayed list (L447-L481).

---

**Inputs & Assumptions:**
- `event` (`React.FormEvent<HTMLFormElement>`): user-triggered panel form submission. Trust: untrusted user interaction (L447-L462, L642-L701).
- Implicit: `form`, `panelMode`, `editingId`, localized copy, current vendor state, and credentialed API client (L279-L292, L464-L479).
- Precondition: mode is `create` or `edit`. Established by the form being rendered only when `panelMode` is truthy (L629-L642).
- Precondition on edit: `editingId` is a vendor id. Established by `openEdit` (L416-L423); runtime non-null check at the call site: nothing found.
- Precondition: numeric text converts to finite fractions accepted by the API. Native number input constraints apply for normal submission (L747-L755); explicit `Number.isFinite` check here: nothing found.

---

**Outputs & Effects:**
- Prevents native navigation, marks pending, clears notices, and creates a payload from current state (L448-L462).
- Sends credentialed POST for create or PATCH using the captured edit id (L464-L467).
- Prepends a created vendor or replaces the matching returned id in local state, shows success copy, then closes the panel (L468-L475).
- Extracts API error copy on rejection and always clears pending state (L476-L480).
- API callees persist user, seller, and permission changes transactionally as recorded in the seller service records.

---

**Block-by-Block:**

```tsx
// L448-L462
event.preventDefault();
setSubmitting(true);
setError("");
setMessage("");
const payload = { ...form fields..., ...(form.password ? { password: form.password } : {}), commission: Number(form.commission) / 100, holdbackRate: Number(form.holdbackRate) / 100, permissions: form.permissions };
```
- **What:** Freezes the request payload and converts displayed percentages to fractions.
- **Why here:** Conversion happens once before endpoint selection and asynchronous work.
- **Assumes:** omission of an empty password means "leave unchanged" on edit and creation cannot submit empty password through normal UI; established by conditional payload at L457 and required create input at L648-L657, with server DTOs authoritative.
- **Establishes:** payload uses a common create/update shape, with password only when truthy.
- **Depended on by:** both API branches at L465-L467.

```tsx
// L464-L467
const response = panelMode === "create"
  ? await api.post<Vendor>("/seller/vendors", payload)
  : await api.patch<Vendor>(`/seller/vendors/${editingId}`, payload);
```
- **What:** Selects mutation method/path from panel mode.
- **Why here:** The same payload preparation and result handling serve both operations.
- **Assumes:** a non-create mode is specifically valid edit mode and has a non-null id. The render condition establishes non-null mode; `openEdit` establishes id, while independent runtime assertion is nothing found.
- **Establishes:** successful path has an Axios response declared as `Vendor`; runtime response-shape validation here: nothing found.
- **Depended on by:** list reconciliation and success message.

```tsx
// L468-L475
setVendors((current) => {
  if (panelMode === "create") return [response.data, ...current];
  return current.map((vendor) => vendor.id === response.data.id ? response.data : vendor);
});
setMessage(panelMode === "create" ? c.created : c.updated);
closePanel();
```
- **What:** Updates local projection from server response and closes the editor.
- **Why here:** UI state follows confirmed server completion.
- **Assumes:** response id identifies the created/updated vendor and, for edit, appears in the current list. API service projection establishes the response id; list membership at response time is not checked.
- **Establishes:** create response is visible first; edit response replaces every matching id; panel is queued closed.
- **Depended on by:** metrics, cards, filters, and GSAP dependency on list length (L353-L405, L524-L625).

```tsx
// L476-L480
catch (requestError) { setError(requestMessage(requestError, c.requestError)); }
finally { setSubmitting(false); }
```
- **What:** Converts rejected operations to panel error and settles pending state.
- **Why here:** One failure path covers both mutation endpoints.
- **Assumes:** component/panel state remains appropriate when the request settles; closing via non-Escape controls while pending is possible (L631, L638, L696).
- **Establishes:** pending becomes false after settlement.
- **Depended on by:** disabled submit button and Escape guard (L314, L697-L699).

---

**Cross-Function Dependencies:**
- Callee shared `api.post`/`api.patch`: Axios client uses configured base and credentials (`client.ts:L3-L8`).
- Callee API create route: `PlatformAdminGuard`, validated DTO, and `SellerService.createVendor` persistence (`seller.controller.ts:L41-L51`; records `api__seller-controller__create-vendor.md`, `api__seller-service__create-vendor.md`).
- Callee API update route: guard, validated path/body, and transactional update (`seller.controller.ts:L53-L65`; records `api__seller-controller__update-vendor.md`, `api__seller-service__update-vendor.md`).
- Callee `requestMessage` (internal): extracts response messages (L257-L270).
- Callee `closePanel` (internal): clears mode/id and restores opener focus (L425-L429).
- Caller: panel form `onSubmit` (L642).
- Shared state: vendor/account/permission rows in API; client `vendors`, `form`, `panelMode`, `editingId`, notices, pending state.
- Invariant coupling: client percentage conversion is inverse to `formFromVendor`; client permissions are replaced by backend transaction on update.

---

**Open Questions:**
- unclear; need interaction requirements for request settlement after the panel is manually closed.
- unclear; need runtime response validation policy for API-sourced `Vendor` objects.
