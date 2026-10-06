import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { MEDIA_BACKUP_LOCK } from "../media/media-backup-lock";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const createdRunIds: string[] = [];
const databaseUrl = process.env.DATABASE_URL!;

before(async () => { await prisma.$connect(); });
after(async () => {
  await prisma.backup_runs.deleteMany({ where: { id: { in: createdRunIds } } });
  await prisma.$disconnect();
});

describe("backup database coordination", () => {
  it("allows exactly one concurrent worker to atomically claim a queued run", async () => {
    const id = randomUUID(); createdRunIds.push(id);
    await prisma.backup_runs.create({ data: { id, trigger: "manual", components: ["database"] } });
    const claim = async () => {
      const token = randomUUID();
      return prisma.$queryRaw<Array<{ id: string }>>`
        WITH candidate AS (
          SELECT id FROM backup_runs
          WHERE status = 'queued'
          ORDER BY created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE backup_runs AS run
        SET status = 'running', claim_token = ${token}::uuid, started_at = CURRENT_TIMESTAMP
        FROM candidate
        WHERE run.id = candidate.id
        RETURNING run.id
      `;
    };
    const claims = await Promise.all([claim(), claim()]);
    assert.equal(claims.flat().filter((row) => row.id === id).length, 1);
    assert.equal((await prisma.backup_runs.findUniqueOrThrow({ where: { id } })).status, "running");
  });

  it("coordinates backup and restore owners through the global advisory lock", async () => {
    const first = new Client({ connectionString: databaseUrl });
    const second = new Client({ connectionString: databaseUrl });
    await Promise.all([first.connect(), second.connect()]);
    try {
      await first.query("BEGIN");
      await first.query("SELECT pg_advisory_xact_lock(8204211946)");
      const blocked = await second.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(8204211946) AS acquired");
      assert.equal(blocked.rows[0]?.acquired, false);
      await first.query("ROLLBACK");
      const acquired = await second.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(8204211946) AS acquired");
      assert.equal(acquired.rows[0]?.acquired, true);
      await second.query("SELECT pg_advisory_unlock(8204211946)");
    } finally { await Promise.all([first.end(), second.end()]); }
  });

  it("opens the backup snapshot only after a concurrent media deletion commits", { timeout: 20_000 }, async () => {
    const writer = new Client({ connectionString: databaseUrl });
    const backup = new Client({ connectionString: databaseUrl });
    // Generated identifier; a standalone fixture avoids changing real media rows.
    const table = `backup_snapshot_fixture_${randomUUID().replaceAll("-", "")}`;
    await Promise.all([writer.connect(), backup.connect()]);
    try {
      await writer.query(`CREATE TABLE ${table} (path text PRIMARY KEY)`);
      await backup.query("SET statement_timeout = '10s'");
      const pid = (await backup.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]!.pid;
      for (const beginBeforeLock of [true, false]) {
        await writer.query(`INSERT INTO ${table} (path) VALUES ('stories/deleted.webp')`);
        await writer.query("BEGIN");
        await writer.query("SELECT pg_advisory_xact_lock_shared($1)", [MEDIA_BACKUP_LOCK]);
        await writer.query(`DELETE FROM ${table}`);

        // The old ordering is a negative control: the waiting SELECT establishes
        // a stale snapshot even though it cannot acquire the lock until commit.
        if (beginBeforeLock) await backup.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const acquiring = backup.query("SELECT pg_advisory_lock($1)", [MEDIA_BACKUP_LOCK]);
        void acquiring.catch(() => undefined);
        let waiting = false;
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const locks = await writer.query<{ waiting: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'advisory' AND NOT granted) AS waiting", [pid]
          );
          if (locks.rows[0]?.waiting) { waiting = true; break; }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(waiting, true, "backup must actually wait for the uncommitted media writer");
        await writer.query("COMMIT");
        await acquiring;
        if (!beginBeforeLock) await backup.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await backup.query("SELECT pg_export_snapshot()");
        const inventory = await backup.query<{ path: string }>(`SELECT path FROM ${table}`);
        assert.equal(inventory.rows.length, beginBeforeLock ? 1 : 0,
          beginBeforeLock ? "old ordering reproduces the deleted-file reference" : "fixed ordering sees the committed deletion");
        await backup.query("COMMIT");
        await backup.query("SELECT pg_advisory_unlock($1)", [MEDIA_BACKUP_LOCK]);
      }
    } finally {
      // Release the writer first so a failing assertion cannot strand the waiter.
      await writer.query("ROLLBACK").catch(() => undefined);
      await backup.query("ROLLBACK").catch(() => undefined);
      await backup.query("SELECT pg_advisory_unlock_all()").catch(() => undefined);
      await writer.query(`DROP TABLE IF EXISTS ${table}`).catch(() => undefined);
      await Promise.all([writer.end(), backup.end()]);
    }
  });

  it("enforces component and restore-job status constraints in PostgreSQL", async () => {
    const invalidRun = randomUUID(); createdRunIds.push(invalidRun);
    await assert.rejects(() => prisma.backup_runs.create({ data: { id: invalidRun, trigger: "manual", components: [] } }), /constraint/i);
    await assert.rejects(() => prisma.$executeRawUnsafe(
      "INSERT INTO backup_restore_jobs (id, archive_id, status, phase, requested_at) VALUES ($1::uuid, $2::uuid, 'unknown', 'validating', CURRENT_TIMESTAMP)",
      randomUUID(), randomUUID()
    ), /constraint/i);
  });
});
