import { strict as assert } from "node:assert";
import { it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

it("allows confirmed admin completion and guards payout reversals", () => {
  const service = new OrderService({} as PrismaService);
  assert.equal(service.adminTransitions("pending", "digital").includes("delivered"), true);
  assert.equal(service.adminTransitions("paid", "physical").includes("delivered"), true);
  assert.equal(service.adminTransitions("processing", "physical").includes("delivered"), true);
  assert.equal(service.adminTransitions("processing", "service").includes("delivered"), true);
  assert.equal(service.adminTransitions("paid", "digital").includes("delivered"), true);
  assert.equal(service.adminTransitions("shipped", "physical").includes("delivered"), true);
  assert.equal(service.adminTransitions("awaiting_confirmation", "service").includes("delivered"), true);
  assert.deepEqual(service.adminTransitions("delivered", "physical", "settled"), []);
  assert.equal(service.adminTransitions("delivered", "physical", "draft").includes("shipped"), true);
  assert.equal(service.adminTransitions("paid", "digital").includes("cancelled"), false);
});
