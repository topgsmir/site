import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { GoghdiService } from "./goghdi.service";

describe("GoghdiService", () => {
  it("signs only the server-constructed active product payload", async () => {
    const prisma = {
      products: {
        findFirst: async () => ({ id: "product-1", title: "Unlock service" })
      }
    } as unknown as PrismaService;
    const config = new ConfigService({
      GOGHDI_TENANT_SECRET: "test-secret",
      GOGHDI_SUPPORT_DEPARTMENT: "support"
    });
    const service = new GoghdiService(prisma, config);

    const result = await service.signProductTicket("product-1");
    const expectedOptions = {
      productId: "product-1",
      chatTitle: "Product support: Unlock service",
      department: "support"
    };

    assert.deepEqual(result.options, expectedOptions);
    assert.equal(
      result.signature,
      createHmac("sha256", "test-secret")
        .update(JSON.stringify(expectedOptions))
        .digest("hex")
    );
  });

  it("does not sign an unpublished or unknown product", async () => {
    const prisma = {
      products: { findFirst: async () => null }
    } as unknown as PrismaService;
    const service = new GoghdiService(
      prisma,
      new ConfigService({ GOGHDI_TENANT_SECRET: "test-secret" })
    );

    await assert.rejects(() => service.signProductTicket("product-1"), /not found/i);
  });
});
