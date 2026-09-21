import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPaymentCanBeRefunded,
  assertRefundCanBeCancelled,
  assertRefundCanBeReviewed,
  fromStripeMinorUnits,
  mapStripeRefundStatus,
} from "../src/app/modules/refund/refund.domain.js";

test("only successful payments can enter the refund workflow", () => {
  assert.doesNotThrow(() => assertPaymentCanBeRefunded("SUCCEEDED"));
  for (const status of ["PENDING", "PROCESSING", "FAILED", "CANCELLED", "REFUNDED"]) {
    assert.throws(() => assertPaymentCanBeRefunded(status));
  }
});

test("only requested refunds can be cancelled or reviewed", () => {
  assert.doesNotThrow(() => assertRefundCanBeCancelled("REQUESTED"));
  assert.doesNotThrow(() => assertRefundCanBeReviewed("REQUESTED"));
  for (const status of ["APPROVED", "PROCESSING", "SUCCEEDED", "REJECTED", "FAILED", "CANCELLED"] as const) {
    assert.throws(() => assertRefundCanBeCancelled(status));
    assert.throws(() => assertRefundCanBeReviewed(status));
  }
});

test("Stripe refund states map to ProcuraX states", () => {
  assert.equal(mapStripeRefundStatus("succeeded"), "SUCCEEDED");
  assert.equal(mapStripeRefundStatus("pending"), "PROCESSING");
  assert.equal(mapStripeRefundStatus("requires_action"), "PROCESSING");
  assert.equal(mapStripeRefundStatus("failed"), "FAILED");
  assert.equal(mapStripeRefundStatus("canceled"), "CANCELLED");
});

test("minor units convert back to persisted refund amounts", () => {
  assert.equal(fromStripeMinorUnits(125050, "USD"), "1250.50");
  assert.equal(fromStripeMinorUnits(1250, "JPY"), "1250");
  assert.throws(() => fromStripeMinorUnits(0, "USD"));
});
