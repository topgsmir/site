import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductDownloadLinksService } from "./product-download-links.service";

const url = (name: string) => `https://uploads.example/${name}.zip`;
const offer = (sellerId = "seller-1") => ({
  id: "offer-1", listing: { seller_id: sellerId, product: { type: "digital" } },
  digital: { file_reference: url("first"), file_references: [url("first"), url("second")], file_titles: ["First", "Second"], max_downloads: 5 }
});

function serviceWith(tx: Record<string, unknown>) {
  const prisma = { $transaction: async (work: (client: unknown) => Promise<unknown>) => work(tx) } as unknown as PrismaService;
  const config = { get: () => "uploads.example" } as unknown as ConfigService;
  return new ProductDownloadLinksService(prisma, config);
}

describe("digital download link management", () => {
  it("only adds a link to the owning seller's offer", async () => {
    const tx = { seller_offers: { findFirst: async ({ where }: { where: { listing: { seller_id: string } } }) => where.listing.seller_id === "seller-1" ? offer() : null },
      seller_offer_digital: { update: async () => { throw new Error("must not update"); } } };
    await assert.rejects(() => serviceWith(tx).addAsSeller("seller-2", "actor-2", "offer-1", { url: url("third"), title: "Third" }), NotFoundException);
  });

  it("stores an edit request without changing the live download URL", async () => {
    let changed = false;
    const service = serviceWith({
      seller_offers: { findFirst: async () => offer() },
      seller_offer_digital: { update: async () => { changed = true; } },
      download_link_change_requests: { create: async ({ data }: { data: { expected_url: string; proposed_url: string } }) => {
        assert.equal(data.expected_url, url("first")); assert.equal(data.proposed_url, url("third"));
        return { id: "request-1", status: "pending" };
      } }
    });
    assert.deepEqual(await service.requestChange("seller-1", "actor-1", "offer-1", { action: "edit", linkIndex: 0, url: url("third"), title: "Third" }), { id: "request-1", status: "pending" });
    assert.equal(changed, false);
  });

  it("adds a seller link and its audit event atomically", async () => {
    const writes: string[] = [];
    const service = serviceWith({
      seller_offers: { findFirst: async () => offer() },
      seller_offer_digital: { update: async () => { writes.push("links"); } },
      download_link_change_events: { create: async ({ data }: { data: { action: string; actor_user_id: string } }) => {
        assert.equal(data.action, "seller_add"); assert.equal(data.actor_user_id, "actor-1"); writes.push("audit");
      } }
    });
    const result = await service.addAsSeller("seller-1", "actor-1", "offer-1", { url: url("third"), title: "Third" });
    assert.deepEqual(result.fileReferences, [url("first"), url("second"), url("third")]);
    assert.deepEqual(writes, ["links", "audit"]);
  });

  it("applies an approved edit and rejects a stale request", async () => {
    let saved: { file_references: string[] } | undefined;
    let audited: { action: string; before_urls: string[]; after_urls: string[] } | undefined;
    const request = { id: "request-1", status: "pending", offer_id: "offer-1", seller_id: "seller-1", action: "edit", link_index: 0,
      expected_url: url("first"), expected_title: "First", proposed_url: url("third"), proposed_title: "Third" };
    const tx = {
      download_link_change_requests: { findUnique: async () => request, update: async () => ({ id: request.id, status: "approved" }) },
      seller_offers: { findFirst: async () => offer() },
      seller_offer_digital: { update: async ({ data }: { data: { file_references: string[] } }) => { saved = data; } },
      download_link_change_events: { create: async ({ data }: { data: typeof audited }) => { audited = data; } }
    };
    await serviceWith(tx).review("request-1", "admin-1", { status: "approved" });
    assert.deepEqual(saved?.file_references, [url("third"), url("second")]);
    assert.equal(audited?.action, "approved_edit");
    assert.deepEqual(audited?.before_urls, [url("first"), url("second")]);
    assert.deepEqual(audited?.after_urls, [url("third"), url("second")]);
    tx.seller_offers.findFirst = async () => ({ ...offer(), digital: { ...offer().digital, file_references: [url("changed"), url("second")] } });
    await assert.rejects(() => serviceWith(tx).review("request-1", "admin-1", { status: "approved" }), ConflictException);
  });

  it("does not change a link when an admin rejects its deletion", async () => {
    let changed = false;
    const service = serviceWith({
      download_link_change_requests: {
        findUnique: async () => ({ id: "request-2", status: "pending", offer_id: "offer-1", action: "delete" }),
        update: async () => ({ id: "request-2", status: "rejected" })
      },
      seller_offer_digital: { update: async () => { changed = true; } }
    });
    assert.deepEqual(await service.review("request-2", "admin-1", { status: "rejected", reason: "Keep the file" }), { id: "request-2", status: "rejected" });
    assert.equal(changed, false);
  });

  it("requires every admin replacement URL to use the configured unsigned host", async () => {
    const service = serviceWith({ seller_offers: { findFirst: async () => offer() } });
    await assert.rejects(() => service.replaceAsAdmin("offer-1", "admin-1", { fileReferences: ["https://other.example/file.zip"], fileTitles: ["File"] }));
  });
});
