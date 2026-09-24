import { strict as assert } from "node:assert";
import { ForbiddenException } from "@nestjs/common";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RequestAuthenticationService } from "../auth/request-authentication.service";
import { SellerProfileGuard } from "./seller-profile.guard";

function contextFor(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request })
  } as never;
}

describe("SellerProfileGuard", () => {
  it("accepts only an active administrator membership and derives the seller id", async () => {
    const user = {
      id: "user-1",
      fullName: "Expert",
      email: "expert@example.com",
      role: "seller-admin"
    } as AppUser;
    const request: Record<string, unknown> = {};
    const authentication = { authenticate: async () => user } as unknown as RequestAuthenticationService;
    const prisma = {
      seller_memberships: {
        findFirst: async () => ({
          role: "admin",
          seller: { id: "seller-1" }
        })
      }
    } as unknown as PrismaService;

    const accepted = await new SellerProfileGuard(authentication, prisma)
      .canActivate(contextFor(request));

    assert.equal(accepted, true);
    assert.equal((request.sellerContext as { sellerId: string }).sellerId, "seller-1");
  });

  it("rejects seller staff before reading a membership", async () => {
    let reads = 0;
    const user = {
      id: "user-2",
      fullName: "Staff",
      email: "staff@example.com",
      role: "seller-staff"
    } as AppUser;
    const authentication = { authenticate: async () => user } as unknown as RequestAuthenticationService;
    const prisma = {
      seller_memberships: { findFirst: async () => { reads += 1; return null; } }
    } as unknown as PrismaService;

    await assert.rejects(
      () => new SellerProfileGuard(authentication, prisma).canActivate(contextFor({})),
      ForbiddenException
    );
    assert.equal(reads, 0);
  });
});
