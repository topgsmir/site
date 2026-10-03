import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Test } from "@nestjs/testing";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { MediaService } from "../media/media.service";
import { SellerController } from "./seller.controller";
import { SellerProfileGuard } from "./seller-profile.guard";
import { SellerService } from "./seller.service";

describe("seller profile picture upload", () => {
  it("uploads a picture for the seller selected by a platform administrator", async () => {
    const sellerId = "00000000-0000-4000-8000-000000000001";
    const uploads: Array<{ sellerId: string; userId: string; role: string }> = [];
    let limited = false;
    const controller = new SellerController(
      {} as SellerService,
      { consumeMediaUpload: async () => { limited = true; } } as unknown as AuthRateLimitService,
      { uploadSellerProfilePicture: async (id: string, userId: string, role: string) => {
        uploads.push({ sellerId: id, userId, role });
        return { id: "picture-id", url: "", width: 640, height: 640 };
      } } as unknown as MediaService
    );
    await controller.uploadVendorPicture(sellerId, undefined, { authenticatedUser: { id: "platform-admin-id" } } as never, "127.0.0.1");
    assert.equal(limited, true);
    assert.deepEqual(uploads, [{ sellerId, userId: "platform-admin-id", role: "platform" }]);
  });

  it("accepts one multipart file and rejects extra fields", async () => {
    const uploads: Array<{ sellerId: string; userId: string; role: string; filename: string }> = [];
    const module = await Test.createTestingModule({
      controllers: [SellerController],
      providers: [
        { provide: SellerService, useValue: {} },
        { provide: AuthRateLimitService, useValue: { consumeMediaUpload: async () => undefined } },
        { provide: MediaService, useValue: {
          uploadSellerProfilePicture: async (sellerId: string, userId: string, role: string, file: Express.Multer.File) => {
            uploads.push({ sellerId, userId, role, filename: file.originalname });
            return { id: "picture-id" };
          }
        } }
      ]
    }).overrideGuard(PlatformPermissionGuard).useValue({ canActivate: () => true }).overrideGuard(SellerProfileGuard).useValue({
      canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
        const request = context.switchToHttp().getRequest();
        request.authenticatedUser = { id: "seller-admin-id" };
        request.sellerContext = { sellerId: "seller-id", membershipRole: "admin" };
        return true;
      }
    }).compile();
    const app = module.createNestApplication({ logger: false });
    try {
      await app.listen(0, "127.0.0.1");
      const url = `${await app.getUrl()}/seller/profile/picture`;
      const form = new FormData();
      form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }), "profile.webp");
      const response = await fetch(url, { method: "POST", body: form });
      assert.equal(response.status, 201, await response.clone().text());
      assert.deepEqual(uploads, [{ sellerId: "seller-id", userId: "seller-admin-id", role: "admin", filename: "profile.webp" }]);

      const invalid = new FormData();
      invalid.set("file", new Blob([new Uint8Array([1])], { type: "image/webp" }), "profile.webp");
      invalid.set("unexpected", "value");
      const rejected = await fetch(url, { method: "POST", body: invalid });
      assert.equal(rejected.status, 400, await rejected.clone().text());
      assert.equal(uploads.length, 1);
    } finally {
      await app.close();
    }
  });
});
