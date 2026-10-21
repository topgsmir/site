/** Prefer the left of the trigger; flip or clamp when the viewport is narrow. */
export function sideMenuPosition(anchor: { left: number; right: number; top: number }, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const gap = 6;
  const margin = 12;
  const left = anchor.left - width - gap >= margin
    ? anchor.left - width - gap
    : anchor.right + width + gap <= viewportWidth - margin
      ? anchor.right + gap
      : Math.max(margin, Math.min(anchor.left - width - gap, viewportWidth - width - margin));
  return { left, top: Math.max(margin, Math.min(anchor.top, viewportHeight - height - margin)) };
}
