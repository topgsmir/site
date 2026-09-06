## `LandingMotion` in apps/web/src/components/landing/LandingMotion.tsx (L9-L60)

**Purpose:** Installs desktop scroll-linked landing-page word and card animations and cleans them up with the component lifecycle (L9-L60).

---

**Inputs & Assumptions:**
- No props.
- Implicit: browser media preferences, DOM elements marked by `LandingPage`, and GSAP/ScrollTrigger globals (L10-L56).
- Precondition: executes client-side. Established by `"use client"` (L1) and React hook lifecycle.

---

**Outputs & Effects:**
- Returns no DOM (L59).
- Installs no animation when reduced motion is requested (L11-L12).
- On desktop media match, queries reveal/card elements and creates scroll animations/triggers (L14-L54).
- Returns `media.revert` cleanup (L56).

---

**Block-by-Block:**

```tsx
// L10-L16
useGSAP(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  const media = gsap.matchMedia();
  media.add("(min-width: 761px)", () => { ... });
```
- **What:** Gates all setup by accessibility and viewport media queries.
- **Why here:** No selectors or triggers are created on reduced-motion path.
- **Assumes:** preference need only be sampled when the hook runs; later preference change subscription: nothing found.
- **Establishes:** subsequent animation setup occurs only for the desktop match managed by GSAP.
- **Depended on by:** animation bodies L17-L53.

```tsx
// L17-L53
const revealWords = gsap.utils.toArray<HTMLElement>("[data-reveal-word]");
gsap.fromTo(revealWords, ...scrollTrigger...);
const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]");
cards.forEach((card, index) => gsap.fromTo(card, ...));
```
- **What:** Creates global-selector word animation and per-card scroll animation.
- **Why here:** Runs only under media gates.
- **Assumes:** matching elements belong to this landing instance; selector scoping is not supplied in this component.
- **Establishes:** GSAP owns animation state/triggers for matched elements.
- **Depended on by:** visual behavior only; no application data/state transition relies on it.

```tsx
// L56
return () => media.revert();
```
- **What:** Reverts match-media-managed GSAP work.
- **Why here:** Cleanup is returned to hook lifecycle.
- **Assumes:** `media.revert` covers all triggers/tweens created in its callbacks; established by GSAP library contract.
- **Establishes:** hook cleanup requests reversal of registered media work.
- **Depended on by:** route/component unmount hygiene.

---

**Cross-Function Dependencies:**
- Callees GSAP, `useGSAP`, `ScrollTrigger`, and browser `matchMedia` (external-source-available libraries/runtime).
- Caller: `LandingPage` (L302).
- Shared state: DOM elements selected from `LandingPage` data attributes.
- Invariant coupling: no security or persistent-data invariant; reduced-motion preference gates motion effects.

---

**Open Questions:**
- unclear; need GSAP version contract to confirm cleanup ownership for all created `ScrollTrigger` instances.
