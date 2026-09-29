import { createHash } from "node:crypto";
import { isIP } from "node:net";

export function isAllowedUnsignedFileUrl(fileReference: string, hosts: string): boolean {
  const allowedHosts = hosts.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (!allowedHosts.length || allowedHosts.some((host) => !/^[a-z0-9.-]+$/.test(host))) return false;
  try {
    const url = new URL(fileReference);
    decodeURIComponent(url.pathname.replace(/\+/g, " "));
    return url.protocol === "https:" && allowedHosts.includes(url.hostname.toLowerCase()) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash &&
      Boolean(url.pathname) && url.pathname !== "/";
  } catch { return false; }
}

/** Matches the legacy upload server's secure_link_md5 input exactly. */
export function signUploadDownloadLink(
  fileReference: string,
  clientIp: string,
  hosts: string,
  secret: string,
  now = Date.now()
): string {
  if (Buffer.byteLength(secret, "utf8") < 32 || !hosts || !isIP(clientIp)) {
    throw new Error("Upload download signing is not configured");
  }

  if (!isAllowedUnsignedFileUrl(fileReference, hosts)) {
    throw new Error("Upload download URL is not an allowed unsigned file URL");
  }
  const url = new URL(fileReference);

  // The legacy PHP code signs urldecode(path), then appends the original path.
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname.replace(/\+/g, " "));
  } catch {
    throw new Error("Upload download path is invalid");
  }
  const expires = Math.floor(now / 1000) + 24 * 60 * 60;
  const md5 = createHash("md5")
    .update(`${expires}${decodedPath}${clientIp} ${secret}`, "utf8")
    .digest("base64url");
  url.searchParams.set("md5", md5);
  url.searchParams.set("expires", String(expires));
  return url.toString();
}
