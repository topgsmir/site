import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { SafeHttpService } from "./safe-http.service";
import { DhruLegacyAdapter } from "./providers/dhru-legacy.adapter";
import { DhruNewAdapter } from "./providers/dhru-new.adapter";
import { WebxAdapter } from "./providers/webx.adapter";

const credentials = { baseUrl: "https://provider.example", username: "seller", apiKey: "secret-api-key" };
function httpWith(handler: (path: string, init: RequestInit) => unknown) {
  return { request: async (_base: string, path: string, init: RequestInit) => handler(path, init) } as SafeHttpService;
}

describe("Bridge provider contracts", () => {
  it("normalizes Legacy Dhru grouped service fixtures", async () => {
    let call = 0;
    const adapter = new DhruLegacyAdapter(httpWith(() => {
      call += 1;
      if (call > 1) throw new Error("unsupported fixture action");
      return { SUCCESS: [{ LIST: [{ GROUPNAME: "IMEI", SERVICES: [{ SERVICEID: "101", SERVICENAME: "IMEI check", CUSTOMFIELDS: [{ name: "Serial", type: "text", required: true }] }] }] }] };
    }));
    const [service] = await adapter.listServices(credentials);
    assert.equal(service.externalId, "101");
    assert.equal(service.kind, "imei");
    assert.equal(service.fields.some((field) => field.key.toLowerCase() === "imei"), true);
  });

  it("normalizes New Dhru product fixtures without retaining prices", async () => {
    const adapter = new DhruNewAdapter(httpWith(() => ({ data: { products: { fallback: { uuid: "svc-2", name: "Server activation", type: "server", price: 900, fields: [{ key: "username", label: "Username", type: "text", required: true }] } } } })));
    const [service] = await adapter.listServices(credentials);
    assert.equal(service.externalId, "svc-2");
    assert.equal(service.kind, "server");
    assert.equal("price" in service.metadata, false);
  });

  it("normalizes WebX main fields and service kind fixtures", async () => {
    const adapter = new WebxAdapter(httpWith((path) => path.includes("imei-services") ? [{ id: 7, name: "Device history", main_field: { key: "device", label: "IMEI", type: "text", required: true } }] : []));
    const [service] = await adapter.listServices(credentials);
    assert.equal(service.externalId, "7");
    assert.equal(service.kind, "imei");
    assert.deepEqual(service.fields.map((field) => field.key), ["device"]);
  });
});
