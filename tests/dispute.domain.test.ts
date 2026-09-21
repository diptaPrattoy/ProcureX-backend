import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDisputeCanBeFinalized,
  assertDisputeCanEnterReview,
  assertInvoiceCanBeDisputed,
  assertPurchaseOrderCanBeDisputed,
} from "../src/app/modules/dispute/dispute.domain.js";

test("only engaged purchase orders can be disputed", () => {
  for (const status of ["ACCEPTED", "IN_PROGRESS", "PARTIALLY_DELIVERED", "DELIVERED", "COMPLETED"] as const) {
    assert.doesNotThrow(() => assertPurchaseOrderCanBeDisputed(status));
  }
  for (const status of ["ISSUED", "REJECTED", "CANCELLED"] as const) {
    assert.throws(() => assertPurchaseOrderCanBeDisputed(status));
  }
});

test("cancelled invoices cannot enter the dispute workflow", () => {
  for (const status of ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "PAYMENT_PENDING", "PAID"] as const) {
    assert.doesNotThrow(() => assertInvoiceCanBeDisputed(status));
  }
  assert.throws(() => assertInvoiceCanBeDisputed("CANCELLED"));
});

test("disputes follow open to review to final state progression", () => {
  assert.doesNotThrow(() => assertDisputeCanEnterReview("OPEN"));
  for (const status of ["UNDER_REVIEW", "RESOLVED", "REJECTED"] as const) {
    assert.throws(() => assertDisputeCanEnterReview(status));
  }

  assert.doesNotThrow(() => assertDisputeCanBeFinalized("UNDER_REVIEW"));
  for (const status of ["OPEN", "RESOLVED", "REJECTED"] as const) {
    assert.throws(() => assertDisputeCanBeFinalized(status));
  }
});
