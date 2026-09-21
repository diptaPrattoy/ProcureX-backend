import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import {
  assertInvoiceCancellationAllowed,
  calculateInvoice,
} from "../src/app/modules/invoice/invoice.domain.js";

const sourceItems = [
  { id: "item-1", unitPrice: 750, acceptedQuantity: 10, invoicedQuantity: 0 },
  { id: "item-2", unitPrice: 125.5, acceptedQuantity: 8, invoicedQuantity: 3 },
];

test("invoice totals are derived from PO prices and requested accepted quantities", () => {
  const result = calculateInvoice(
    "PARTIALLY_DELIVERED",
    sourceItems,
    [
      { purchaseOrderItemId: "item-1", quantity: 2 },
      { purchaseOrderItemId: "item-2", quantity: 5 },
    ],
    212.75,
  );

  assert.equal(result.items[0]?.unitPrice, 750);
  assert.equal(result.items[0]?.lineTotal, 1500);
  assert.equal(result.items[1]?.lineTotal, 627.5);
  assert.equal(result.subtotal, 2127.5);
  assert.equal(result.taxAmount, 212.75);
  assert.equal(result.totalAmount, 2340.25);
});

test("invoice quantity cannot exceed accepted quantity remaining after prior invoices", () => {
  assert.throws(
    () =>
      calculateInvoice(
        "PARTIALLY_DELIVERED",
        sourceItems,
        [{ purchaseOrderItemId: "item-2", quantity: 6 }],
        0,
      ),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("items with no remaining accepted quantity cannot be invoiced again", () => {
  assert.throws(
    () =>
      calculateInvoice(
        "DELIVERED",
        [{ id: "item-1", unitPrice: 10, acceptedQuantity: 5, invoicedQuantity: 5 }],
        [{ purchaseOrderItemId: "item-1", quantity: 1 }],
        0,
      ),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("invoicing before accepted goods exist is blocked by PO state", () => {
  for (const status of ["ISSUED", "ACCEPTED", "IN_PROGRESS", "REJECTED", "CANCELLED"] as const) {
    assert.throws(
      () =>
        calculateInvoice(
          status,
          sourceItems,
          [{ purchaseOrderItemId: "item-1", quantity: 1 }],
          0,
        ),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});

test("invoice item must belong to the purchase order", () => {
  assert.throws(
    () =>
      calculateInvoice(
        "DELIVERED",
        sourceItems,
        [{ purchaseOrderItemId: "foreign-item", quantity: 1 }],
        0,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test("tax cannot exceed the subtotal", () => {
  assert.throws(
    () =>
      calculateInvoice(
        "DELIVERED",
        sourceItems,
        [{ purchaseOrderItemId: "item-1", quantity: 1 }],
        751,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test("only submitted invoices can be cancelled by a supplier", () => {
  assert.doesNotThrow(() => assertInvoiceCancellationAllowed("SUBMITTED"));
  for (const status of ["UNDER_REVIEW", "APPROVED", "REJECTED", "PAYMENT_PENDING", "PAID", "CANCELLED"]) {
    assert.throws(
      () => assertInvoiceCancellationAllowed(status),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});
