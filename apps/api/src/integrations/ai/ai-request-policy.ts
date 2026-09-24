// Total budget per model call, including a response that is still streaming.
// AI transport inactivity uses the same budget; the abort signal caps total duration.
export const AI_REQUEST_TIMEOUT_MS = 180_000;
