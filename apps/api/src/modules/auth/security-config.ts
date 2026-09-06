import { ConfigService } from "@nestjs/config";

const LOCAL_WEB_ORIGIN = "http://localhost:3000";

export function getAllowedWebOrigins(config: ConfigService) {
  const environment = config.get<string>("NODE_ENV") ?? "development";
  const configured = config.get<string>("WEB_ORIGIN")?.trim();

  if (environment === "production" && !configured) {
    throw new Error("WEB_ORIGIN must be configured in production");
  }

  const origins = (configured || LOCAL_WEB_ORIGIN)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(parseExactWebOrigin);

  if (!origins.length) throw new Error("At least one WEB_ORIGIN is required");
  if (environment === "production" && origins.some((origin) => !origin.startsWith("https://"))) {
    throw new Error("Production WEB_ORIGIN values must use HTTPS");
  }

  return [...new Set(origins)];
}

export function validateSecurityConfig(config: ConfigService) {
  const environment = config.get<string>("NODE_ENV") ?? "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  getAllowedWebOrigins(config);

  const cookieDomain = config.get<string>("AUTH_COOKIE_DOMAIN")?.trim();
  if (cookieDomain && !/^(?:\.?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*)$/.test(cookieDomain)) {
    throw new Error("AUTH_COOKIE_DOMAIN is invalid");
  }

  const trustProxyHops = Number(config.get<string>("TRUST_PROXY_HOPS") ?? "0");
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer between 0 and 10");
  }

  return { trustProxyHops };
}

function parseExactWebOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid WEB_ORIGIN: ${value}`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.origin === "null"
  ) {
    throw new Error(`WEB_ORIGIN must be an exact HTTP(S) origin: ${value}`);
  }

  return url.origin;
}
