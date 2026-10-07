import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProfilePictureService, profilePictureUrl } from "./profile-picture.service";

const userId = "70b031a8-2935-43d5-94ea-c07c954722c8";
const oldKey = "70b031a8-2935-43d5-94ea-c07c954722c9";

it("replaces the old file while the same public URL resolves to the new picture", async () => {
  const root = await mkdtemp(join(tmpdir(), "topgsm-profile-picture-"));
  const directory = join(root, "users", userId, "profile");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${oldKey}.webp`), Buffer.from("old picture"));
  let key: string | null = oldKey;
  const tx = {
    $executeRaw: async () => undefined,
    $queryRaw: async () => [{ id: userId }],
    users: {
      findFirst: async () => ({ profile_picture_key: key }),
      update: async ({ data }: { data: { profile_picture_key: string | null } }) => { key = data.profile_picture_key; }
    }
  };
  const prisma = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx), users: tx.users } as unknown as PrismaService;
  const config = { get: () => root } as unknown as ConfigService;
  const pictures = new ProfilePictureService(config, prisma);
  try {
    const source = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer();
    const result = await pictures.upload(userId, { buffer: source, mimetype: "image/png" } as Express.Multer.File);
    assert.ok(key && key !== oldKey);
    assert.equal(result.url?.split("?")[0], profilePictureUrl(userId, oldKey)?.split("?")[0]);
    await assert.rejects(readFile(join(directory, `${oldKey}.webp`)), { code: "ENOENT" });
    const served = await pictures.get(userId);
    assert.deepEqual(served.buffer, await readFile(join(directory, `${key}.webp`)));
    assert.equal((await sharp(served.buffer).metadata()).format, "webp");
    await pictures.remove(userId);
    assert.equal(key, null);
    await assert.rejects(readFile(join(directory, `${served.etag.slice(1, -1)}.webp`)), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects mismatched image content before writing", async () => {
  const prisma = { $transaction: async () => { throw new Error("unexpected write"); } } as unknown as PrismaService;
  const pictures = new ProfilePictureService({ get: () => tmpdir() } as unknown as ConfigService, prisma);
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).png().toBuffer();
  await assert.rejects(() => pictures.upload(userId, { buffer: png, mimetype: "image/jpeg" } as Express.Multer.File), { status: 400 });
});

it("keeps the previous picture when the profile update fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "topgsm-profile-failure-"));
  const directory = join(root, "users", userId, "profile");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${oldKey}.webp`), Buffer.from("original"));
  const tx = {
    $executeRaw: async () => undefined,
    $queryRaw: async () => [{ id: userId }],
    users: {
      findFirst: async () => ({ profile_picture_key: oldKey }),
      update: async () => { throw new Error("database failed"); }
    }
  };
  const prisma = { $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaService;
  const pictures = new ProfilePictureService({ get: () => root } as unknown as ConfigService, prisma);
  try {
    const source = await sharp({ create: { width: 8, height: 8, channels: 3, background: "green" } }).png().toBuffer();
    await assert.rejects(() => pictures.upload(userId, { buffer: source, mimetype: "image/png" } as Express.Multer.File), /database failed/);
    assert.deepEqual(await readdir(directory), [`${oldKey}.webp`]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
