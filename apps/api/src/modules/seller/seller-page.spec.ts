import "reflect-metadata";
import { strict as assert } from "node:assert";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { describe, it } from "node:test";
import { UpdateSellerPageDto } from "./dto/seller-directory.dto";
import { normalizeSellerPage, readStoredSellerPage } from "./seller-page";

const textId = "22222222-2222-4222-8222-222222222222";
const productsId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";

describe("seller page sections", () => {
  it("accepts ordered text and product sections and rejects a repeated product", () => {
    const page = normalizeSellerPage([
      { id: textId, type: "text", title: "عنوان", body: "متن صفحه" },
      { id: productsId, type: "products", title: "", productIds: [productId] }
    ]);
    assert.equal(page.length, 2);
    assert.throws(
      () => normalizeSellerPage([
        { id: productsId, type: "products", title: "", productIds: [productId] },
        { id: textId, type: "products", title: "", productIds: [productId.toUpperCase()] }
      ]),
      (error: unknown) => error instanceof BadRequestException && error.message === "Each product can appear once on the page"
    );
  });

  it("drops damaged stored sections and keeps a readable page", () => {
    assert.deepEqual(readStoredSellerPage([
      { id: textId, type: "text", title: "عنوان", body: "متن" },
      { id: "not-an-id", type: "text", title: "خراب", body: "متن" },
      { id: productsId, type: "products", title: "فایل‌ها", productIds: [productId, "also-bad"] }
    ]), [
      { id: textId, type: "text", title: "عنوان", body: "متن" },
      { id: productsId, type: "products", title: "فایل‌ها", productIds: [productId] }
    ]);
    assert.deepEqual(readStoredSellerPage({ blocks: [] }), []);
  });

  it("rejects undeclared fields on a page section", async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const valid = await pipe.transform({
      blocks: [{ id: textId, type: "text", title: "عنوان", body: "متن صفحه" }]
    }, { type: "body", metatype: UpdateSellerPageDto });
    assert.equal(valid.blocks[0].title, "عنوان");
    await assert.rejects(() => pipe.transform({
      blocks: [{ id: textId, type: "text", title: "عنوان", body: "متن", extra: true }]
    }, { type: "body", metatype: UpdateSellerPageDto }), BadRequestException);
  });
});
