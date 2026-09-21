import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInvoiceCanEnterPayment,
  isReusableCheckoutStatus,
  isTerminalPaymentStatus,
  toStripeMinorUnits,
} from "../src/app/modules/payment/payment.domain.js";

test("approved and payment-pending invoices are payable", () => {
  assert.doesNotThrow(() => assertInvoiceCanEnterPayment("APPROVED"));
  assert.doesNotThrow(() => assertInvoiceCanEnterPayment("PAYMENT_PENDING"));
});

test("unapproved or paid invoices cannot enter payment", () => {
  for (const status of ["SUBMITTED", "UNDER_REVIEW", "REJECTED", "PAID", "CANCELLED"] as const) {
    assert.throws(() => assertInvoiceCanEnterPayment(status));
  }
});

test("Stripe minor-unit conversion is deterministic", () => {
  assert.equal(toStripeMinorUnits("1250.50", "USD"), 125050);
  assert.equal(toStripeMinorUnits("1250", "USD"), 125000);
  assert.equal(toStripeMinorUnits("1250", "JPY"), 1250);
  assert.throws(() => toStripeMinorUnits("1250.50", "JPY"));
});

test("only pending and processing checkout attempts are reusable", () => {
  assert.equal(isReusableCheckoutStatus("PENDING"), true);
  assert.equal(isReusableCheckoutStatus("PROCESSING"), true);
  assert.equal(isReusableCheckoutStatus("FAILED"), false);
  assert.equal(isReusableCheckoutStatus("SUCCEEDED"), false);
});

test("payment terminal status helper recognizes final states", () => {
  assert.equal(isTerminalPaymentStatus("PENDING"), false);
  assert.equal(isTerminalPaymentStatus("PROCESSING"), false);
  assert.equal(isTerminalPaymentStatus("SUCCEEDED"), true);
  assert.equal(isTerminalPaymentStatus("FAILED"), true);
  assert.equal(isTerminalPaymentStatus("CANCELLED"), true);
  assert.equal(isTerminalPaymentStatus("REFUNDED"), true);
});
