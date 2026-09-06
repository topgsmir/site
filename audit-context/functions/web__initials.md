## `initials` in apps/web/src/components/landing/LandingPage.tsx (L275-L277)

**Purpose:** Derives a two-character-or-shorter avatar label from the first two whitespace-delimited name parts (L275-L277).

---

**Inputs & Assumptions:**
- `name` (`string`): API/fallback agent name; semi-trusted at runtime.
- Precondition: none; empty/whitespace input yields an empty string through the implemented chain.

---

**Outputs & Effects:** Returns concatenated first characters of up to two parts; no effects (L276).

---

**Block-by-Block:**

```tsx
// L276
return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("");
```
- **What:** Normalizes surrounding whitespace, tokenizes, truncates, and extracts initials.
- **Why here:** Agent cards need text-only avatar content.
- **Assumes:** JavaScript code-unit `charAt(0)` is acceptable for supported names.
- **Establishes:** output contains at most two selected first code units.
- **Depended on by:** agent avatar render (L376).

---

**Cross-Function Dependencies:**
- No project callees.
- Caller: `LandingPage` agent mapping.
- Shared state: none.
- Invariant coupling: none.

---

**Open Questions:**
- No open questions.
