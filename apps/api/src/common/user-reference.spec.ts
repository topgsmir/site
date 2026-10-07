import assert from "node:assert/strict";
import { it } from "node:test";
import { validate } from "class-validator";
import type { PrismaService } from "../prisma/prisma.service";
import { UserIdDto } from "../modules/admin-users/dto/admin-users.dto";
import { DeletionQueryDto, CreateDeletionDto, LifecycleCandidateSearchDto } from "../modules/admin-users/dto/user-lifecycle.dto";
import { SellerCustomerIdDto, SellerCustomerSearchDto } from "../modules/order/dto/seller-customers.dto";
import { resolveUserId, userReferenceWhere } from "./user-reference";

const uuid = "3dd30b78-d1dc-44e0-a420-798e474b7a0a";

it("accepts user UUIDs and support codes only at user-reference inputs", async () => {
  for (const [dto, field] of [
    [new UserIdDto(), "id"], [new SellerCustomerIdDto(), "id"],
    [new DeletionQueryDto(), "replacementUserId"], [new CreateDeletionDto(), "replacementUserId"],
    [new LifecycleCandidateSearchDto(), "cursor"], [new SellerCustomerSearchDto(), "cursor"]
  ] as const) {
    for (const reference of ["01409", "00000", "99999", uuid]) {
      Object.assign(dto, { [field]: reference });
      assert.ok(!(await validate(dto)).some((error) => error.property === field), reference);
    }
    for (const reference of ["bad-reference", "7K4P9", "1234", "123456", "12.34", " 12345", "۱۲۳۴۵"]) {
      Object.assign(dto, { [field]: reference });
      assert.ok((await validate(dto)).some((error) => error.property === field), reference);
    }
  }
});

it("resolves a support code once and leaves UUIDs as canonical database IDs", async () => {
  let lookup: unknown;
  const prisma = { users: { findUnique: async (input: { where: unknown }) => { lookup = input.where; return { id: uuid }; } } } as unknown as PrismaService;
  assert.equal(await resolveUserId(prisma, "01409"), uuid);
  assert.deepEqual(lookup, { support_code: "01409" });
  assert.equal(await resolveUserId(prisma, uuid.toUpperCase()), uuid);
  assert.deepEqual(userReferenceWhere("01409"), { support_code: "01409" });
});
