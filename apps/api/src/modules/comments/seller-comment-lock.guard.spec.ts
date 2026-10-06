import { strict as assert } from "node:assert";
import { it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthService } from "../auth/auth.service";
import type { CommentsService } from "./comments.service";
import { SellerCommentLockGuard } from "./seller-comment-lock.guard";

it("blocks a locked seller's workspace API request but allows comment handling", async () => {
  const auth = { getUserFromToken: async () => ({ id: "seller-1", role: "seller-admin" }) } as unknown as AuthService;
  const comments = { isLockedUser: async () => true } as unknown as CommentsService;
  const guard = new SellerCommentLockGuard(auth, comments);
  const request = { path: "/api/products/mine", headers: { authorization: "Bearer token" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  await assert.rejects(() => guard.canActivate(context), { name: "ForbiddenException" });
  request.path = "/api/comments/seller";
  assert.equal(await guard.canActivate(context), true);
});

it("applies the seller comment lock when a platform owner uses their shop", async () => {
  const owner = { id: "owner", role: "platform-admin" };
  const auth = { getUserFromToken: async () => owner, inSellerWorkspace: async () => ({ ...owner, role: "seller-admin" }) } as unknown as AuthService;
  const comments = { isLockedUser: async (user: { role: string }) => user.role === "seller-admin" } as unknown as CommentsService;
  const request = { path: "/api/products/mine", headers: { authorization: "Bearer token", "x-topgsm-workspace": "seller" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  await assert.rejects(new SellerCommentLockGuard(auth, comments).canActivate(context), { name: "ForbiddenException" });
});
