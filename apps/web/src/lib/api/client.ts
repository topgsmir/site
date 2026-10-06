import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true
});

// Request-local context keeps admin and seller tabs independent. The API verifies
// ownership and narrows authority; this header never grants a role or seller ID.
api.interceptors.request.use((request) => {
  if (typeof window !== "undefined" && /^\/(fa|en|ar)\/seller-dashboard(?:\/|$)/.test(window.location.pathname) && request.url !== "/seller/own-shop") {
    request.headers.set("X-TopGSM-Workspace", "seller");
  }
  return request;
});
