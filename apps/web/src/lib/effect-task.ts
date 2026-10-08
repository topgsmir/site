/**
 * Start external work after effect setup. A discarded setup (including Strict
 * Mode's replay) never starts the task; a started task keeps its own cleanup.
 * Keep UI derived from props in render and user actions in event handlers.
 */
export function scheduleEffectTask(task: () => void | (() => void)): () => void {
  let cancelled = false;
  let cleanup: void | (() => void);
  queueMicrotask(() => {
    if (!cancelled) cleanup = task();
  });
  return () => {
    if (cancelled) return;
    cancelled = true;
    cleanup?.();
  };
}
