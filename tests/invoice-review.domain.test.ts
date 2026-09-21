import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import {
  assertInvoiceApprovalAllowed,
  assertInvoiceRejectionAllowed,
  assertInvoiceReviewStartAllowed,
} from "../src/app/modules/invoice/invoice.domain.js";

test("only submitted invoices can enter buyer review", () => {
  assert.doesNotThrow(() => assertInvoiceReviewStartAllowed("SUBMITTED"));
  for (const status of [
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "PAYMENT_PENDING",
    "PAID",
    "CANCELLED",
  ] as const) {
    assert.throws(
      () => assertInvoiceReviewStartAllowed(status),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});

test("only invoices under review can be approved", () => {
  assert.doesNotThrow(() => assertInvoiceApprovalAllowed("UNDER_REVIEW"));
  for (const status of [
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "PAYMENT_PENDING",
    "PAID",
    "CANCELLED",
  ] as const) {
    assert.throws(
      () => assertInvoiceApprovalAllowed(status),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});

test("only invoices under review can be rejected", () => {
  assert.doesNotThrow(() => assertInvoiceRejectionAllowed("UNDER_REVIEW"));
  for (const status of [
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "PAYMENT_PENDING",
    "PAID",
    "CANCELLED",
  ] as const) {
    assert.throws(
      () => assertInvoiceRejectionAllowed(status),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});
