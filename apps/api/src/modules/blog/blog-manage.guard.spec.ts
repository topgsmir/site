import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestAuthenticationService } from "../auth/request-authentication.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BlogManageGuard } from "./blog-manage.guard";

function target() {
  const request: AuthenticatedRequest = { headers: {} };
  return {
    request,
    context: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext
  };
}

describe("blog author permission matrix", () => {
  it("carries the seller review policy into the authorized actor", async () => {
    const authentication = { authenticate: async () => ({ id: "user", fullName: "Seller", email: "s@example.com", role: "seller-admin" }) } as unknown as RequestAuthenticationService;
    const prisma = {
      seller_memberships: {
        findFirst: async () => ({
          role: "admin",
          seller: { id: "seller", blog_review_required: true }
        })
      }
    } as unknown as PrismaService;
    const guard = new BlogManageGuard(authentication, prisma);
    const value = target();
    assert.equal(await guard.canActivate(value.context), true);
    assert.deepEqual(value.request.blogActor, {
      type: "seller",
      sellerId: "seller",
      reviewRequired: true,
      user: { id: "user", fullName: "Seller", email: "s@example.com", role: "seller-admin" }
    });
    assert.deepEqual(value.request.sellerContext, {
      sellerId: "seller",
      membershipRole: "admin",
      user: { id: "user", fullName: "Seller", email: "s@example.com", role: "seller-admin" }
    });
  });

  it("rejects sellers without an active database permission row", async () => {
    const authentication = { authenticate: async () => ({ id: "user", fullName: "Seller", email: "s@example.com", role: "seller-staff" }) } as unknown as RequestAuthenticationService;
    const prisma = { seller_memberships: { findFirst: async () => null } } as unknown as PrismaService;
    const guard = new BlogManageGuard(authentication, prisma);
    await assert.rejects(guard.canActivate(target().context), ForbiddenException);
  });
});
