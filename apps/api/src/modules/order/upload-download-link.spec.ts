import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { signUploadDownloadLink } from "./upload-download-link";

describe("upload download link signing", () => {
  const now = Date.UTC(2026, 8, 19, 12);
  const secret = "an-independent-deployment-secret-of-32-plus-bytes";
  const hosts = "uploads.example.com";

  it("matches the legacy md5 format, binds the IP, and expires after 24 hours", () => {
    const url = new URL(signUploadDownloadLink("https://uploads.example.com/files/a%20b.zip", "192.0.2.10", hosts, secret, now));
    const expires = Math.floor(now / 1000) + 86400;
    const expected = createHash("md5")
      .update(`${expires}/files/a b.zip192.0.2.10 ${secret}`)
      .digest("base64url");
    assert.equal(url.searchParams.get("expires"), String(expires));
    assert.equal(url.searchParams.get("md5"), expected);
    assert.equal(url.pathname, "/files/a%20b.zip");
    assert.notEqual(new URL(signUploadDownloadLink("https://uploads.example.com/files/a%20b.zip", "192.0.2.11", hosts, secret, now)).searchParams.get("md5"), expected);
  });

  it("rejects unsigned file references outside the configured host and malformed input", () => {
    for (const reference of [
      "https://uploads.example.com.evil.test/file.zip",
      "http://uploads.example.com/file.zip",
      "https://uploads.example.com/file.zip?skp=1",
      "https://uploads.example.com/file.zip#fragment",
      "https://user@uploads.example.com/file.zip",
      "https://uploads.example.com:8443/file.zip",
      "https://uploads.example.com/"
    ]) {
      assert.throws(() => signUploadDownloadLink(reference, "192.0.2.10", hosts, secret, now));
    }
    assert.throws(() => signUploadDownloadLink("https://uploads.example.com/file.zip", "192.0.2.10", hosts, "", now));
    assert.throws(() => signUploadDownloadLink("https://uploads.example.com/file.zip", "not-an-ip", hosts, secret, now));
  });
});
