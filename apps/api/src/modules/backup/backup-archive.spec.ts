import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { BackupArchiveService, type BackupArchiveManifest } from "./backup-archive.service";

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

function archiveService() {
  const values: Record<string, string> = {
    BACKUP_ARCHIVE_CURRENT_KEY_ID: "k1",
    BACKUP_ARCHIVE_CREDENTIAL_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
    BACKUP_MAX_ARCHIVE_BYTES: String(32 * 1024 * 1024)
  };
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new BackupArchiveService(config, new CredentialCryptoService(config));
}

describe("BackupArchiveService", () => {
  it("round-trips a chunk-authenticated package and verifies manifest hashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-backup-test-")); temporary.push(root);
    const media = join(root, "media"); await mkdir(join(media, "products"), { recursive: true });
    const uploadPath = join(media, "products", "asset.bin"); await writeFile(uploadPath, Buffer.from("upload-content"));
    const service = archiveService();
    const archiveId = randomUUID();
    const uploadHash = await service.sha256(uploadPath);
    const manifest: BackupArchiveManifest = {
      formatVersion: 1, archiveId, createdAt: new Date().toISOString(), appVersion: "test", migrationId: "20260922130000_backup_restore",
      postgresMajor: 16, components: ["uploads"], database: null,
      uploads: [{ path: "products/asset.bin", bytes: (await stat(uploadPath)).size, sha256: uploadHash }],
      uploadsBytes: (await stat(uploadPath)).size, platformOwnerCount: 1
    };
    const plain = join(root, "plain.tgz"); const encrypted = join(root, "archive.topgsm-backup");
    const decrypted = join(root, "decrypted.tgz"); const extracted = join(root, "extracted");
    await service.packPlainArchive(plain, manifest, null, media, manifest.uploads);
    await service.encrypt(plain, encrypted, archiveId);
    assert.equal((await service.decrypt(encrypted, decrypted)).archiveId, archiveId);
    assert.deepEqual(await service.extractPlainArchive(decrypted, extracted), manifest);
    assert.equal(await readFile(join(extracted, "uploads", "products", "asset.bin"), "utf8"), "upload-content");
  });

  it("rejects one-byte package tampering", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-backup-test-")); temporary.push(root);
    const service = archiveService(); const archiveId = randomUUID();
    const manifest: BackupArchiveManifest = {
      formatVersion: 1, archiveId, createdAt: new Date().toISOString(), appVersion: "test", migrationId: null,
      postgresMajor: 16, components: ["uploads"], database: null, uploads: [], uploadsBytes: 0, platformOwnerCount: 1
    };
    const plain = join(root, "plain.tgz"); const encrypted = join(root, "archive.topgsm-backup");
    await service.packPlainArchive(plain, manifest, null, root, []); await service.encrypt(plain, encrypted, archiveId);
    const handle = await open(encrypted, "r+");
    try { const metadata = await handle.stat(); const byte = Buffer.alloc(1); await handle.read(byte, 0, 1, metadata.size - 1); byte[0] ^= 1; await handle.write(byte, 0, 1, metadata.size - 1); }
    finally { await handle.close(); }
    await assert.rejects(() => service.decrypt(encrypted, join(root, "decrypted.tgz")), /authentication/i);
  });

  it("rejects upload paths that escape MEDIA_ROOT", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-backup-test-")); temporary.push(root);
    const service = archiveService(); const archiveId = randomUUID();
    const manifest: BackupArchiveManifest = {
      formatVersion: 1, archiveId, createdAt: new Date().toISOString(), appVersion: "test", migrationId: null,
      postgresMajor: 16, components: ["uploads"], database: null,
      uploads: [{ path: "../outside", bytes: 1, sha256: "0".repeat(64) }], uploadsBytes: 1, platformOwnerCount: 1
    };
    await assert.rejects(() => service.packPlainArchive(join(root, "plain.tgz"), manifest, null, root, manifest.uploads), /path/i);
  });
});
