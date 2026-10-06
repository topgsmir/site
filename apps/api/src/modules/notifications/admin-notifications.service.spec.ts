import assert from "node:assert/strict";
import test from "node:test";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminNotificationsController } from "./admin-notifications.controller";
import { AdminNotificationsService } from "./admin-notifications.service";

test("counts only requests in the admin review queues", async () => {
  const filters: Record<string, unknown> = {};
  const values = { comments: 7, media_deletion_requests: 2, products: 3, blog_posts: 4, bridge_fulfillments: 1, payout_ledger: 5, download_link_change_requests: 6 };
  const prisma = Object.fromEntries(Object.entries(values).map(([model, count]) => [model, {
    count: async (input: unknown) => { filters[model] = input; return count; }
  }])) as unknown as PrismaService;
  const result = await new AdminNotificationsService(prisma).counts();

  assert.deepEqual(result, { comments: 7, photos: 2, products: 3, articles: 4, refunds: 1, payouts: 5, downloadLinks: 6 });
  assert.deepEqual(filters, {
    comments: { where: { status: "pending" } },
    media_deletion_requests: { where: { status: "pending" } },
    products: { where: { status: "pending_review" } },
    blog_posts: { where: { archived_at: null, working_revision: { status: "pending_review" } } },
    bridge_fulfillments: { where: { status: "refund_requested" } },
    payout_ledger: { where: { status: "requested" } },
    download_link_change_requests: { where: { status: "pending" } }
  });
});

test("the count route requires a platform administrator", () => {
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, AdminNotificationsController), [PlatformAdminGuard]);
});
