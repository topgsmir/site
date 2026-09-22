import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DigitalFulfillmentDto } from "./product.dto";
import { DigitalDownloadQueryDto } from "../../order/dto/digital-download.dto";

describe("digital file validation", () => {
  const errors = (input: object) => validate(plainToInstance(DigitalFulfillmentDto, { maxDownloads: 2, ...input }));
  it("accepts multiple files and legacy single URLs", async () => {
    assert.equal((await errors({ fileReferences: ["https://uploads.example/a.zip", "https://uploads.example/b.zip"] })).length, 0);
    assert.equal((await errors({ fileReference: "https://uploads.example/a.zip" })).length, 0);
  });
  it("rejects missing, empty, duplicate, oversized and unsafe file lists", async () => {
    for (const input of [{}, { fileReferences: null }, { fileReferences: [] }, { fileReferences: "https://uploads.example/a" }, { fileReferences: ["http://uploads.example/a"] }, { fileReferences: [null] }, { fileReferences: ["https://uploads.example/a", "https://uploads.example/a"] }, { fileReferences: ["https://uploads.example/" + "a".repeat(2048)] }, { fileReferences: Array.from({ length: 51 }, (_, index) => `https://uploads.example/${index}`) }]) {
      assert.ok((await errors(input)).length > 0, JSON.stringify(input));
    }
  });
  it("bounds file selection and defaults legacy downloads to the first file", async () => {
    assert.equal(plainToInstance(DigitalDownloadQueryDto, {}).fileIndex, 0);
    for (const fileIndex of ["-1", "50", "1.5", "bad"]) assert.ok((await validate(plainToInstance(DigitalDownloadQueryDto, { fileIndex }))).length > 0);
    assert.equal((await validate(plainToInstance(DigitalDownloadQueryDto, { fileIndex: "1" }))).length, 0);
  });
});
