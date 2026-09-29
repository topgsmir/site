import assert from "node:assert/strict";
import { it } from "node:test";
import { digitalFileTitles, mapDigitalDeliveries } from "./digital-delivery";

it("keeps file titles aligned with order delivery indices", () => {
  const titles = digitalFileTitles({ file_reference: "https://files.example/a", file_references: ["https://files.example/a", "https://files.example/b"], file_titles: ["Guide", "Archive"] });
  assert.deepEqual(titles, ["Guide", "Archive"]);
  assert.deepEqual(mapDigitalDeliveries("order", "item", [{ file_index: 1, delivery_url: "https://files.example/b", max_downloads: 2, download_count: 0 }], titles)[0]?.title, "Archive");
  assert.equal(mapDigitalDeliveries("order", "item", [{ file_index: 0, delivery_url: "https://files.example/a", max_downloads: 2, download_count: 0 }])[0]?.title, null);
});
