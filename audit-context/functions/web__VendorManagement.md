## `VendorManagement` in apps/web/src/components/admin/VendorManagement.tsx (L272-L707)

**Purpose:** Provides the platform-administrator client workspace for loading, searching, creating, and updating vendor accounts, commercial terms, status, and permissions (L272-L707).

---

**Inputs & Assumptions:**
- `locale` (`Locale`) and `adminName` (`string`): supplied by the server page after `requireUser` permits only platform administrators (`admin/page.tsx:L23-L31`). Trust: trusted page composition; `adminName` originates from API user projection.
- Implicit: credentialed API base/cookies, browser DOM, GSAP, React state, and seller API response shapes (L3-L16, L279-L392).
- Precondition: this component is not independently an authorization boundary. Established by the enclosing page guard and each API route's `PlatformAdminGuard` (`admin/page.tsx:L29`; `seller.controller.ts:L35-L64`).

---

**Outputs & Effects:**
- Loads vendor projections on mount and displays request state (L294-L309, L558-L568).
- Manages panel focus, document body class, and Escape/Tab listener while the panel is open (L311-L351).
- Filters local vendors by shop/owner/email and derives counts (L394-L405).
- Maintains create/edit form, permission, panel, and notice state (L407-L487).
- Create/update submission invokes persistent API mutations and reconciles response data locally (L447-L481).
- Installs and reverts presentation-only GSAP/ScrollTrigger behavior (L353-L392).

---

**Block-by-Block:**

```tsx
// L279-L292
const c = copy[locale];
const root = useRef<HTMLElement>(null);
const panel = useRef<HTMLElement>(null);
const panelTrigger = useRef<HTMLButtonElement | null>(null);
const [vendors, setVendors] = useState<Vendor[]>([]);
...panel/form/submitting/message/error state...
```
- **What:** Establishes localized copy and the client workspace state model.
- **Why here:** Network callbacks, mutation forms, filtering, and rendering share it.
- **Assumes:** `locale` is one of the copy keys; established by page-level `isLocale` before rendering (`admin/page.tsx:L24-L29`).
- **Establishes:** empty/loading initial collection and closed editor.
- **Depended on by:** all subsequent effects and handlers.

```tsx
// L294-L351
async function loadVendors() { ... }
useEffect(() => { void loadVendors(); }, []);
useEffect(() => { ...initial focus, body class, Escape/Tab focus listener, cleanup... }, [panelMode, submitting]);
```
- **What:** Starts the data lifecycle and installs modal focus/global behavior.
- **Why here:** Collection load begins at mount; body/listener lifecycle follows panel state.
- **Assumes:** initial-load callback capture of locale/copy/API remains valid for the component lifetime; dependency lint disposition: not visible here.
- **Establishes:** load is requested once per mount; open panels receive initial-focus scheduling and focus cycling; cleanup cancels its frame and removes its own body class/listener (L337-L350).
- **Depended on by:** collection and panel UI.

```tsx
// L394-L405
const filteredVendors = useMemo(() => { ... }, [locale, query, vendors]);
const activeCount = vendors.filter(...).length;
const restrictedCount = vendors.length - activeCount;
```
- **What:** Derives search results and dashboard totals from current state.
- **Why here:** No extra persistent state is introduced for derivable values.
- **Assumes:** shop/owner/email are strings; API response runtime validation here: nothing found.
- **Establishes:** restricted means every status other than active (L404-L405).
- **Depended on by:** metrics and vendor cards (L524-L625).

```tsx
// L407-L481
function openCreate() { ... }
function openEdit(vendor: Vendor) { ... }
function closePanel() { ... }
function updateField(...) { ... }
function togglePermission(...) { ... }
async function submitVendor(...) { ... }
```
- **What:** Defines the editable state machine and its persistent transition.
- **Why here:** All callbacks close over the same current component state.
- **Assumes:** mode/id/form stay associated through async submission. Established on open paths; user closure while pending can alter queued UI state and is recorded in callback records.
- **Establishes:** successful responses, rather than request payload alone, become displayed vendor state (L468-L473).
- **Depended on by:** panel and per-card controls (L518-L701).

---

**Cross-Function Dependencies:**
- Internal callbacks: `loadVendors`, `openCreate`, `openEdit`, `closePanel`, `updateField`, `togglePermission`, `submitVendor`, `statusLabel`; each state/network-relevant callback has its own record.
- Callees seller API list/create/update routes through shared Axios client; server records follow controller, guard, service, DTO, and persistence paths.
- Callee `LogoutButton`: terminates session from this privileged workspace (L502).
- Caller: `AdminPanelPage`, after locale and platform-admin checks (`admin/page.tsx:L23-L31`).
- Shared state: vendor list and edit state locally; user/seller/permission records remotely; authentication cookie; global body class.
- Invariant coupling: page and API independently apply platform-admin authorization; client mode/id chooses mutation route but API guard/service determine accepted persistent change.

---

**Open Questions:**
- unclear; need runtime interaction tests for overlapping load/mutation completion and panel closure during submission.
- unclear; need rendered-style and keyboard interaction inspection to establish the complete focusable set used by the dialog's selector.
