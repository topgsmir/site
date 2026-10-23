/** Zero days preserves unlimited access for historical purchases. */
export function remainingAccessDays(days: number | undefined, activatedAt: Date, now = Date.now()): number | null {
  if (!days) return null;
  return Math.max(0, Math.ceil((activatedAt.getTime() + days * 86_400_000 - now) / 86_400_000));
}
