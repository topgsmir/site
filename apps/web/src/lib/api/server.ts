import "server-only";

const DEFAULT_SERVER_API_BASE = "http://127.0.0.1:4000/api";

export const SERVER_API_BASE = (
  process.env.API_URL ?? DEFAULT_SERVER_API_BASE
).replace(/\/+$/, "");
