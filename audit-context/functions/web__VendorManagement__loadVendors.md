## `VendorManagement.loadVendors` in apps/web/src/components/admin/VendorManagement.tsx (L294-L305)

**Purpose:** Loads the administrator's vendor collection into component state and coordinates loading/error presentation (L294-L305).

---

**Inputs & Assumptions:**
- No explicit parameters.
- Implicit: shared credentialed API client, localized `c`, and React setters captured by the component (L279-L292).
- Precondition: caller is rendered only after the admin server page permits `platform-admin`. Established by `AdminPanelPage` calling `requireUser(locale, ["platform-admin"])` (`admin/page.tsx:L23-L31`).
- Precondition: successful response data is `Vendor[]`. Runtime establishment in the browser: nothing found; the Axios generic is compile-time only (L298-L299).

---

**Outputs & Effects:**
- Sets loading true and clears shared error before requesting (L295-L296).
- Sends credentialed `GET /seller/vendors` and replaces vendor state on success (L298-L299).
- Sets localized load error on rejection and always clears loading (L300-L304).

---

**Block-by-Block:**

```tsx
// L295-L299
setLoading(true);
setError("");
const response = await api.get<Vendor[]>("/seller/vendors");
setVendors(response.data);
```
- **What:** Marks loading, performs the request, and replaces the list.
- **Why here:** Existing error is cleared before a retry; list changes only after resolution.
- **Assumes:** response data is the declared array shape; runtime validation: nothing found.
- **Establishes:** on success, component vendor state references response data.
- **Depended on by:** metrics, filtering, cards, and edit selection (L360-L387, L486-L584).

```tsx
// L300-L304
catch { setError(c.loadError); }
finally { setLoading(false); }
```
- **What:** Collapses all rejection causes into localized copy and settles loading.
- **Why here:** Cleanup covers every request outcome.
- **Assumes:** retaining the prior vendor list on a later failed reload is acceptable; explicit clearing: nothing found.
- **Establishes:** request settlement queues `loading=false`.
- **Depended on by:** skeleton/empty/list rendering (L517-L527).

---

**Cross-Function Dependencies:**
- Callee shared `api.get` uses configured base and credentials (`client.ts:L3-L8`).
- Callee API route `SellerController.listVendors` is guarded and delegates database projection (`seller.controller.ts:L35-L39`; record `api__seller-controller__list-vendors.md`).
- Caller: mount effect invokes once (L307-L309).
- Shared state: `vendors`, `loading`, and the same `error` channel used by submission failures.
- Invariant coupling: returned vendors supply identifiers later placed into PATCH paths by `openEdit`/`submitVendor` (L416-L467).

---

**Open Questions:**
- unclear; need component lifetime/concurrency behavior if a request resolves after unmount.
