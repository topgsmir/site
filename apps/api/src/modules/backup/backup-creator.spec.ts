import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Client } from "pg";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { BackupArchiveService } from "./backup-archive.service";
import { BackupCreatorService } from "./backup-creator.service";
import { BackupPathsService } from "./backup-paths.service";

async function fixture(t: TestContext, uploads: string[], homepages: unknown[], failAt?: string) {
  const root = await mkdtemp(join(tmpdir(), "topgsm-backup-inventory-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = new ConfigService({
    DATABASE_URL: "postgresql://test:test@invalid.test/test",
    MEDIA_ROOT: join(root, "media"), BACKUP_ROOT: join(root, "backups"),
    BACKUP_ARCHIVE_CURRENT_KEY_ID: "test",
    BACKUP_ARCHIVE_CREDENTIAL_KEYS: `test:${Buffer.alloc(32, 7).toString("base64")}`
  });
  const paths = new BackupPathsService(config);
  const archive = new BackupArchiveService(config, new CredentialCryptoService(config));
  const calls: string[] = [];
  t.mock.method(Client.prototype, "connect", async () => undefined);
  t.mock.method(Client.prototype, "end", async () => undefined);
  t.mock.method(Client.prototype, "query", (async (sql: string) => {
    calls.push(sql);
    if (failAt && sql.startsWith(failAt)) throw new Error("simulated database failure");
    if (sql.includes("pg_export_snapshot")) return { rows: [{ snapshot: "test-snapshot" }] };
    if (sql.startsWith("SHOW")) return { rows: [{ version: "160000" }] };
    if (sql.includes("COUNT(*)")) return { rows: [{ count: "1" }] };
    if (sql.includes("FROM blog_media_variants")) {
      for (const source of ["product_media_variants", "seller_profile_media_assets", "homepage_stories"]) assert.ok(sql.includes(source));
      return { rows: uploads.map((path) => ({ path })) };
    }
    if (sql === "SELECT content FROM homepage_content") return { rows: homepages.map((content) => ({ content })) };
    return { rows: [] };
  }) as Client["query"]);
  return { root, paths, archive, calls, creator: new BackupCreatorService(config, paths, archive) };
}

describe("backup upload inventory", () => {
  it("round-trips persisted homepage images, all stories and existing media without copying unrelated files", async (t) => {
    const [hero, shortcut, collection, offer] = Array.from({ length: 4 }, () => `${randomUUID()}.webp`);
    const url = (name: string) => `/homepage-images/${name}`;
    const legacy = ["blog/asset.webp", "products/asset.webp", "profiles/asset.webp", "stories/disabled/asset.webp"];
    const homepages = [
      { hero: { image: url(hero) }, shortcuts: [{ image: url(shortcut) }], collections: { items: [{ image: url(collection) }] }, offers: { items: [{ image: url(offer) }] } },
      { hero: { image: url(hero) }, shortcuts: [{ image: "/images/bundled.png" }] },
      null
    ];
    const { root, paths, archive, calls, creator } = await fixture(t, legacy, homepages);
    const expected = [...legacy, ...[hero, shortcut, collection, offer].map((name) => `homepage/${name}`)].sort();
    for (const path of [...expected, "homepage/unreferenced.webp", "unrelated.txt"]) {
      await mkdir(dirname(join(paths.mediaRoot, path)), { recursive: true });
      await writeFile(join(paths.mediaRoot, path), `bytes:${path}`);
    }
    const backup = await creator.create(randomUUID(), ["uploads"]);
    assert.deepEqual(backup.manifest.uploads.map(({ path }) => path), expected);
    const decrypted = join(root, "decrypted.tgz");
    const restored = join(root, "restored");
    await archive.decrypt(backup.archivePath, decrypted);
    assert.deepEqual(await archive.extractPlainArchive(decrypted, restored), backup.manifest);
    for (const path of expected) assert.equal(await readFile(join(restored, "uploads", path), "utf8"), `bytes:${path}`);
    assert.deepEqual((await readdir(join(restored, "uploads", "homepage"))).sort(), [hero, shortcut, collection, offer].sort());
    const lock = calls.findIndex((sql) => sql === "SELECT pg_advisory_lock($1)");
    const begin = calls.findIndex((sql) => sql.startsWith("BEGIN"));
    const snapshot = calls.findIndex((sql) => sql.includes("pg_export_snapshot"));
    const inventory = calls.indexOf("SELECT content FROM homepage_content");
    const commit = calls.indexOf("COMMIT");
    const unlock = calls.indexOf("SELECT pg_advisory_unlock($1)");
    assert.ok(lock >= 0 && lock < begin && begin < snapshot && snapshot < inventory && inventory < commit && commit < unlock);
    assert.equal(calls.filter((sql) => sql.includes("pg_advisory_unlock")).length, 1);
  });

  it("releases the session lock when BEGIN or snapshot creation fails", async (t) => {
    for (const failAt of ["BEGIN", "SELECT pg_export_snapshot"]) {
      await t.test(failAt, async (subtest) => {
        const { creator, calls } = await fixture(subtest, [], [], failAt);
        await assert.rejects(creator.create(randomUUID(), ["uploads"]), /simulated database failure/);
        assert.deepEqual(calls.slice(-2), ["ROLLBACK", "SELECT pg_advisory_unlock($1)"]);
      });
    }
  });

  it("fails closed on a missing referenced image or unsafe persisted homepage URL", async (t) => {
    for (const image of [`/homepage-images/${randomUUID()}.webp`, "/homepage-images/../../outside.webp"]) {
      await t.test(image, async (subtest) => {
        const { creator, calls } = await fixture(subtest, [], [{ hero: { image } }]);
        await assert.rejects(creator.create(randomUUID(), ["uploads"]), /ENOENT|persisted homepage upload URL/);
        assert.deepEqual(calls.slice(-2), ["ROLLBACK", "SELECT pg_advisory_unlock($1)"]);
      });
    }
  });

  it("rejects a referenced upload directory that is a symlink or junction", async (t) => {
    const { root, paths, creator } = await fixture(t, ["stories/asset.webp"], []);
    const outside = join(root, "outside");
    await mkdir(outside); await mkdir(paths.mediaRoot);
    await writeFile(join(outside, "asset.webp"), "outside-content");
    await symlink(outside, join(paths.mediaRoot, "stories"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(creator.create(randomUUID(), ["uploads"]), /symbolic link/);
  });
});
