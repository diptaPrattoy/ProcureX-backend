import assert from "node:assert/strict";
import test from "node:test";
import { buildRateLimitIdentifier, normalizeClientIp } from "../src/app/middlewares/rateLimit.domain.js";

test("normalizes IPv4-mapped IPv6 addresses", () => {
  assert.equal(normalizeClientIp("::ffff:203.0.113.12"), "203.0.113.12");
});

test("rate limit identifiers remain separated by limiter scope", () => {
  assert.equal(buildRateLimitIdentifier("global", "203.0.113.12"), "global:203.0.113.12");
  assert.equal(buildRateLimitIdentifier("auth", "203.0.113.12"), "auth:203.0.113.12");
});

test("missing client addresses use a stable fallback", () => {
  assert.equal(buildRateLimitIdentifier("global", undefined), "global:unknown");
});
