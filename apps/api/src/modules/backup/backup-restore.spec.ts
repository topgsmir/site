import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import { BackupRestoreService } from "./backup-restore.service";

function service(prisma: PrismaService, auth: AuthService = {} as AuthService) {
  return new BackupRestoreService(
    { get: () => "false" } as never, prisma, auth, {} as never, {} as never, {} as never, {} as never, {} as never
  );
}

describe("BackupRestoreService challenge safety", () => {
  it("rejects an expired or already consumed challenge before checking a password", async () => {
    let checked = false;
    const restore = service(
      { backup_restore_challenges: { findFirst: async () => null } } as unknown as PrismaService,
      { verifyCurrentPassword: async () => { checked = true; } } as unknown as AuthService
    );
    await assert.rejects(() => restore.confirm({ challengeId: "00000000-0000-4000-8000-000000000001", password: "secret", phrase: "RESTORE ABCD1234" }, "owner"), /expired|already used/i);
    assert.equal(checked, false);
  });

  it("uses an atomic consume so a replay loses even after password verification", async () => {
    const phraseHash = createHash("sha256").update("RESTORE ABCD1234").digest("hex");
    const challenge = {
      id: "00000000-0000-4000-8000-000000000001", phrase_hash: phraseHash, manifest: {}, staged_archive_path: "archive"
    };
    const restore = service({
      backup_restore_challenges: { findFirst: async () => challenge },
      $transaction: async (callback: (transaction: unknown) => unknown) => callback({
        $queryRaw: async () => [], backup_runs: { findFirst: async () => null }, backup_restore_jobs: { findFirst: async () => null },
        backup_restore_challenges: { updateMany: async () => ({ count: 0 }) }
      })
    } as unknown as PrismaService, { verifyCurrentPassword: async () => undefined } as unknown as AuthService);
    await assert.rejects(() => restore.confirm({ challengeId: challenge.id, password: "secret", phrase: "RESTORE ABCD1234" }, "owner"), /already used/i);
  });
});
