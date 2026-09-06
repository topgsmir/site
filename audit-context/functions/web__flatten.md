## `flatten` in apps/web/src/lib/i18n/index.ts (L34-L45)

**Purpose:** Converts nested translation dictionaries into mutable dotted-key lookup tables used by `t` (L34-L51).

---

**Inputs & Assumptions:**
- `prefix` (`string`): accumulated key prefix; trusted internal input.
- `obj` (`Record<string, unknown>`): translation object; trusted source data imported at L1-L3.
- `out` (`Dict`, default `{}`): accumulator owned by the call tree (L34).
- Precondition: leaves intended for translation are strings, and nested containers are non-null objects. Established by dictionary types at L10-L12 and `satisfies` at L28-L32; runtime ignores other leaf types (L38-L42).

---

**Outputs & Effects:**
- Mutates `out` by assigning each string leaf under a dotted path and returns it (L35-L45).
- Recurses into object values (L40-L42).

---

**Block-by-Block:**

```ts
// L35-L43
Object.keys(obj).forEach((key) => {
  const value = obj[key];
  const full = prefix ? `${prefix}.${key}` : key;
  if (typeof value === "string") out[full] = value;
  else if (typeof value === "object" && value !== null) flatten(full, value as Record<string, unknown>, out);
});
```
- **What:** Traverses own enumerable keys depth-first.
- **Why here:** Module initialization builds `FLAT` once for each locale (L47-L51).
- **Assumes:** translation dictionaries contain no cyclic objects. Established by static object literals; nothing found as a general runtime check.
- **Establishes:** every visited string leaf has one dotted-key entry, with later collisions overwriting earlier entries.
- **Depended on by:** `FLAT`, then `t` (L47-L54).

---

**Cross-Function Dependencies:**
- Callee `flatten` (internal recursive call): reuses the same accumulator (L41).
- Callers: module initialization for `fa`, `en`, `ar` (L47-L51).
- Shared state: each returned mutable dictionary is retained in `FLAT`; no later writers found.
- Invariant couplings: `TranslationKey` derives only from `fa` (L26), while all three runtime maps are flattened independently (L47-L51).

---

**Open Questions:**
- unclear; need an automated locale parity check to establish that every `fa` key exists in `en` and `ar`; nothing found in this module.

