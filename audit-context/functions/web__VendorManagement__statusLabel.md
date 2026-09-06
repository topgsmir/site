## `VendorManagement.statusLabel` in apps/web/src/components/admin/VendorManagement.tsx (L483-L487)

**Purpose:** Maps a vendor status to localized display copy (L483-L487).

---

**Inputs & Assumptions:**
- `status` (`VendorStatus`): API/form-sourced status. Trust: semi-trusted at runtime.
- Implicit: localized copy `c` selected from a validated locale (L279).

---

**Outputs & Effects:**
- Returns active copy for `active`, suspended copy for `suspended`, and invited copy for every other runtime value (L484-L486).
- No effects.

---

**Block-by-Block:**

```tsx
// L484-L486
if (status === "active") return c.statusActive;
if (status === "suspended") return c.statusSuspended;
return c.statusInvited;
```
- **What:** Performs two exact checks and a default mapping.
- **Why here:** Keeps status rendering localized in one callback.
- **Assumes:** all remaining valid union values mean invited; established by the compile-time `VendorStatus` union, runtime validation of API data here: nothing found.
- **Establishes:** always returns a localized string.
- **Depended on by:** vendor status chip (L579-L580).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: vendor card mapping (L568-L580).
- Shared state: localized copy and API-derived vendor state.
- Invariant coupling: CSS class uses raw status while text uses this mapping (L579-L580).

---

**Open Questions:**
- No open questions.
