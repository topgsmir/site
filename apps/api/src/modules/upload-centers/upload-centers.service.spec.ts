import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { UploadCentersService } from "./upload-centers.service";

test("upload center URLs are normalized, can be disabled, and reject unsafe schemes or credentials", async () => {
  let saved = { free_url: "", regular_url: "" };
  const prisma = {
    upload_center_settings: {
      findUnique: async () => saved,
      upsert: async ({ create }: { create: { free_url: string; regular_url: string } }) => {
        saved = create;
        return saved;
      }
    }
  } as unknown as PrismaService;
  const service = new UploadCentersService(prisma);

  assert.deepEqual(await service.update({ freeUrl: " https://free.example/upload ", regularUrl: "" }), {
    freeUrl: "https://free.example/upload", regularUrl: ""
  });
  assert.deepEqual(await service.get(), { freeUrl: "https://free.example/upload", regularUrl: "" });
  for (const freeUrl of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "not a URL"]) {
    await assert.rejects(() => service.update({ freeUrl, regularUrl: "" }), BadRequestException);
  }
});
