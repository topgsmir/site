import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { assertDedicatedTestDatabase } from "./test-database";

describe("integration database safety", () => {
  it("accepts PostgreSQL database names explicitly marked as test", () => {
    assert.doesNotThrow(() =>
      assertDedicatedTestDatabase({
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://user:password@localhost:5432/topgsm_test"
      })
    );
    assert.doesNotThrow(() =>
      assertDedicatedTestDatabase({
        NODE_ENV: "test",
        DATABASE_URL: "postgres://user:password@localhost:5432/test"
      })
    );
  });

  it("rejects missing, malformed, non-PostgreSQL, and non-test targets", () => {
    assert.throws(() => assertDedicatedTestDatabase({ NODE_ENV: "development" }), /NODE_ENV=test/);
    assert.throws(() => assertDedicatedTestDatabase({ NODE_ENV: "test" }), /dedicated test database/);
    assert.throws(
      () => assertDedicatedTestDatabase({ NODE_ENV: "test", DATABASE_URL: "not-a-url" }),
      /valid PostgreSQL/
    );
    assert.throws(
      () => assertDedicatedTestDatabase({ NODE_ENV: "test", DATABASE_URL: "mysql://localhost/topgsm_test" }),
      /PostgreSQL/
    );
    assert.throws(
      () => assertDedicatedTestDatabase({ NODE_ENV: "test", DATABASE_URL: "postgresql://localhost/topgsm" }),
      /non-test database/
    );
  });
});
