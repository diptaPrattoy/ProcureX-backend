import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCacheKey,
  stableSerialize,
} from "../src/app/modules/cache/cache.domain.js";

test("stable cache serialization is independent of object property order", () => {
  assert.equal(
    stableSerialize({
      page: 1,
      filters: { country: "Bangladesh", city: "Dhaka" },
    }),
    stableSerialize({
      filters: { city: "Dhaka", country: "Bangladesh" },
      page: 1,
    }),
  );
});

test("cache serialization normalizes dates and omits undefined values", () => {
  assert.equal(
    stableSerialize({
      from: new Date("2026-09-01T00:00:00.000Z"),
      ignored: undefined,
    }),
    '{"from":"2026-09-01T00:00:00.000Z"}',
  );
});

test("cache keys are ProcuraX namespaced and deterministic", () => {
  assert.equal(
    buildCacheKey("Supplier Directory", { country: "Bangladesh", page: 1 }),
    'procurax:supplier-directory:{"country":"Bangladesh","page":1}',
  );
});
