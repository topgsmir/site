import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { BackupDestinationService } from "./backup-destination.service";

describe("BackupDestinationService security policy", () => {
  const service = new BackupDestinationService({ get: () => "" } as unknown as ConfigService, {} as PrismaService, {} as CredentialCryptoService);

  it("requires an explicit insecure-mode acknowledgement for plain FTP", async () => {
    await assert.rejects(() => service.create({
      name: "Legacy", protocol: "ftp", host: "backup.example.com", port: 21, username: "backup", remotePath: "/topgsm",
      retentionCount: 30, allowInsecure: false, password: "secret"
    }, "owner"), /explicit insecure-mode/i);
  });

  it("requires a pinned SHA-256 host key for SFTP", async () => {
    await assert.rejects(() => service.create({
      name: "Offsite", protocol: "sftp", host: "backup.example.com", port: 22, username: "backup", remotePath: "/topgsm",
      retentionCount: 30, allowInsecure: false, password: "secret"
    }, "owner"), /fingerprint/i);
  });

  it("maps only configured-state flags and never returns encrypted credentials", () => {
    const publicValue = service.map({
      id: "00000000-0000-4000-8000-000000000001", name: "Offsite", protocol: "sftp", host: "backup.example.com", port: 22,
      username: "backup", remote_path: "/topgsm", retention_count: 30, enabled: false, host_key_fingerprint: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      allow_insecure: false, encrypted_password: "ciphertext", encrypted_private_key: null, encrypted_key_passphrase: null,
      encryption_key_id: "k1", credential_hint: "cret", verified_at: null, last_test_status: "never", last_error_code: null,
      created_at: new Date("2026-01-01T00:00:00Z"), updated_at: new Date("2026-01-01T00:00:00Z")
    });
    assert.equal(publicValue.credentialConfigured, true);
    assert.equal(publicValue.privateKeyConfigured, false);
    assert.equal("encrypted_password" in publicValue, false);
    assert.equal("credential_hint" in publicValue, false);
  });
});
