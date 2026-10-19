import assert from "node:assert/strict";
import test from "node:test";
import { ComplaintsService } from "./complaints.service";

function serviceWith(row: { phone_number: string; telegram_id: string } | null) {
  let saved: { phone_number: string; telegram_id: string } | null = row;
  const prisma = {
    complaints_settings: {
      findUnique: async () => saved,
      upsert: async ({ create, update }: { create: { phone_number: string; telegram_id: string }; update: { phone_number: string; telegram_id: string } }) => {
        saved = { phone_number: update.phone_number ?? create.phone_number, telegram_id: update.telegram_id ?? create.telegram_id };
        return saved;
      }
    }
  };
  return { service: new ComplaintsService(prisma as never), getSaved: () => saved };
}

test("returns empty complaints contacts when unset", async () => {
  const { service } = serviceWith(null);
  assert.deepEqual(await service.get(), { phoneNumber: "", telegramId: "" });
});

test("normalizes phone spacing and telegram handles", async () => {
  const { service, getSaved } = serviceWith(null);
  const result = await service.update({ phoneNumber: " 0912 345 6789 ", telegramId: "@TopGsm_Support" });
  assert.deepEqual(result, { phoneNumber: "0912 345 6789", telegramId: "TopGsm_Support" });
  assert.deepEqual(getSaved(), { phone_number: "0912 345 6789", telegram_id: "TopGsm_Support" });
});

test("accepts telegram profile urls", async () => {
  const { service } = serviceWith(null);
  const result = await service.update({ phoneNumber: "", telegramId: "https://t.me/TopGsm_Support" });
  assert.equal(result.telegramId, "TopGsm_Support");
});

test("rejects invalid telegram ids", async () => {
  const { service } = serviceWith(null);
  await assert.rejects(() => service.update({ phoneNumber: "", telegramId: "ab" }));
  await assert.rejects(() => service.update({ phoneNumber: "not-a-phone", telegramId: "" }));
});
