import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BackupPathsService } from "./backup-paths.service";
import { BackupUploadGuard } from "./backup-upload.guard";

function context(contentLength: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({
      authenticatedUser: { id: "owner" }, ip: "192.0.2.1", headers: { "content-length": contentLength }
    }) })
  } as unknown as ExecutionContext;
}

describe("BackupUploadGuard", () => {
  it("checks the shared rate limit before touching the staging directory", async () => {
    let touchedStaging = false;
    const guard = new BackupUploadGuard(
      { get: () => "8" } as unknown as ConfigService,
      { ensure: async () => { touchedStaging = true; } } as unknown as BackupPathsService,
      { consumeBackupRestore: async () => { throw new Error("rate limit reached"); } } as unknown as AuthRateLimitService
    );
    await assert.rejects(() => guard.canActivate(context("8")), /rate limit reached/);
    assert.equal(touchedStaging, false);
  });

  it("rejects a new upload when staging would exceed its quota", async () => {
    const root = await mkdtemp(join(tmpdir(), "topgsm-backup-guard-"));
    try {
      const values: Record<string, string> = { BACKUP_ROOT: root, BACKUP_MAX_ARCHIVE_BYTES: "8", BACKUP_MAX_STAGING_BYTES: "16" };
      const config = { get: (key: string) => values[key] } as unknown as ConfigService;
      const paths = new BackupPathsService(config);
      await paths.ensure();
      await writeFile(join(paths.staging, "existing.upload"), Buffer.alloc(9));
      const guard = new BackupUploadGuard(config, paths, { consumeBackupRestore: async () => undefined } as unknown as AuthRateLimitService);
      await assert.rejects(() => guard.canActivate(context("8")), /staging quota is full/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
