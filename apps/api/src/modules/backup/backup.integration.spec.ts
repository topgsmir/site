import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";

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

  it("enforces component and restore-job status constraints in PostgreSQL", async () => {
    const invalidRun = randomUUID(); createdRunIds.push(invalidRun);
    await assert.rejects(() => prisma.backup_runs.create({ data: { id: invalidRun, trigger: "manual", components: [] } }), /constraint/i);
    await assert.rejects(() => prisma.$executeRawUnsafe(
      "INSERT INTO backup_restore_jobs (id, archive_id, status, phase, requested_at) VALUES ($1::uuid, $2::uuid, 'unknown', 'validating', CURRENT_TIMESTAMP)",
      randomUUID(), randomUUID()
    ), /constraint/i);
  });
});
