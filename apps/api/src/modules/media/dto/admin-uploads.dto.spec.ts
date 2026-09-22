import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AdminUploadsQueryDto, RestoreAdminUploadsDto, TrashAdminUploadsDto } from "./admin-uploads.dto";

describe("admin uploads DTO validation", () => {
  it("accepts a bounded typed trash request", async () => {
    const dto = plainToInstance(TrashAdminUploadsDto, {
      items: [{ source: "blog", id: "00000000-0000-4000-8000-000000000001" }],
      reason: "Duplicate upload"
    });
    assert.equal((await validate(dto)).length, 0);
  });

  it("rejects invalid references, short reasons, and batches over 50", async () => {
    const dto = plainToInstance(TrashAdminUploadsDto, {
      items: Array.from({ length: 51 }, () => ({ source: "remote", id: "not-a-uuid" })),
      reason: "x"
    });
    const errors = await validate(dto);
    assert.ok(errors.some((error) => error.property === "items"));
    assert.ok(errors.some((error) => error.property === "reason"));
  });

  it("rejects an empty restore request and unsupported list filters", async () => {
    const restore = plainToInstance(RestoreAdminUploadsDto, { items: [] });
    assert.ok((await validate(restore)).some((error) => error.property === "items"));

    const query = plainToInstance(AdminUploadsQueryDto, { limit: 51, source: "remote", sort: "random" });
    const errors = await validate(query);
    assert.deepEqual(new Set(errors.map((error) => error.property)), new Set(["limit", "source", "sort"]));
  });
});
