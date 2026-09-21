import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import { evaluateGoodsReceipt } from "../src/app/modules/goods-receipt/goods-receipt.domain.js";

const order = [
  { id: "item-1", orderedQuantity: 20, acceptedToDate: 0 },
  { id: "item-2", orderedQuantity: 20, acceptedToDate: 0 },
];

test("fully accepted final receipt delivers the purchase order", () => {
  const result = evaluateGoodsReceipt("IN_PROGRESS", order, [
    { purchaseOrderItemId: "item-1", quantityReceived: 20, quantityAccepted: 20, quantityRejected: 0 },
    { purchaseOrderItemId: "item-2", quantityReceived: 20, quantityAccepted: 20, quantityRejected: 0 },
  ]);

  assert.equal(result.receiptStatus, "ACCEPTED");
  assert.equal(result.nextPurchaseOrderStatus, "DELIVERED");
});

test("partial accepted quantities move the purchase order to partially delivered", () => {
  const result = evaluateGoodsReceipt("IN_PROGRESS", order, [
    { purchaseOrderItemId: "item-1", quantityReceived: 10, quantityAccepted: 10, quantityRejected: 0 },
    { purchaseOrderItemId: "item-2", quantityReceived: 10, quantityAccepted: 8, quantityRejected: 2 },
  ]);

  assert.equal(result.receiptStatus, "PARTIALLY_ACCEPTED");
  assert.equal(result.nextPurchaseOrderStatus, "PARTIALLY_DELIVERED");
});

test("rejected units can be replaced later because only accepted units consume fulfillment", () => {
  const result = evaluateGoodsReceipt(
    "PARTIALLY_DELIVERED",
    [
      { id: "item-1", orderedQuantity: 20, acceptedToDate: 8 },
      { id: "item-2", orderedQuantity: 20, acceptedToDate: 20 },
    ],
    [
      { purchaseOrderItemId: "item-1", quantityReceived: 12, quantityAccepted: 12, quantityRejected: 0 },
    ],
  );

  assert.equal(result.nextPurchaseOrderStatus, "DELIVERED");
});

test("an all-rejected first batch keeps fulfillment in progress", () => {
  const result = evaluateGoodsReceipt("IN_PROGRESS", order, [
    { purchaseOrderItemId: "item-1", quantityReceived: 5, quantityAccepted: 0, quantityRejected: 5 },
  ]);

  assert.equal(result.receiptStatus, "REJECTED");
  assert.equal(result.nextPurchaseOrderStatus, "IN_PROGRESS");
});

test("over-receiving beyond remaining unaccepted quantity is blocked", () => {
  assert.throws(
    () =>
      evaluateGoodsReceipt(
        "PARTIALLY_DELIVERED",
        [{ id: "item-1", orderedQuantity: 20, acceptedToDate: 15 }],
        [
          { purchaseOrderItemId: "item-1", quantityReceived: 6, quantityAccepted: 6, quantityRejected: 0 },
        ],
      ),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("accepted and rejected quantities must reconcile to the received quantity", () => {
  assert.throws(
    () =>
      evaluateGoodsReceipt("IN_PROGRESS", order, [
        { purchaseOrderItemId: "item-1", quantityReceived: 10, quantityAccepted: 8, quantityRejected: 1 },
      ]),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test("goods receipts cannot be recorded before fulfillment starts or after delivery", () => {
  for (const status of ["ISSUED", "ACCEPTED", "DELIVERED", "COMPLETED"] as const) {
    assert.throws(
      () =>
        evaluateGoodsReceipt(status, order, [
          { purchaseOrderItemId: "item-1", quantityReceived: 1, quantityAccepted: 1, quantityRejected: 0 },
        ]),
      (error) => error instanceof AppError && error.statusCode === 409,
    );
  }
});
