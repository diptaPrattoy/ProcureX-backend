import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import { assertPurchaseOrderTransition } from "../src/app/modules/purchase-order/purchase-order.domain.js";

test("supplier can accept or reject only an issued purchase order", () => {
  assert.equal(
    assertPurchaseOrderTransition({ status: "ISSUED", actor: "SUPPLIER", action: "ACCEPT" }),
    "ACCEPTED",
  );
  assert.equal(
    assertPurchaseOrderTransition({ status: "ISSUED", actor: "SUPPLIER", action: "REJECT" }),
    "REJECTED",
  );

  assert.throws(
    () =>
      assertPurchaseOrderTransition({ status: "ACCEPTED", actor: "SUPPLIER", action: "REJECT" }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("supplier can start fulfillment only after accepting the purchase order", () => {
  assert.equal(
    assertPurchaseOrderTransition({
      status: "ACCEPTED",
      actor: "SUPPLIER",
      action: "START_FULFILLMENT",
    }),
    "IN_PROGRESS",
  );

  assert.throws(
    () =>
      assertPurchaseOrderTransition({
        status: "ISSUED",
        actor: "SUPPLIER",
        action: "START_FULFILLMENT",
      }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("buyer can cancel only before supplier acceptance", () => {
  assert.equal(
    assertPurchaseOrderTransition({ status: "ISSUED", actor: "BUYER", action: "CANCEL" }),
    "CANCELLED",
  );

  assert.throws(
    () => assertPurchaseOrderTransition({ status: "ACCEPTED", actor: "BUYER", action: "CANCEL" }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("actor restrictions are enforced by domain transition rules", () => {
  assert.throws(
    () => assertPurchaseOrderTransition({ status: "ISSUED", actor: "BUYER", action: "ACCEPT" }),
    (error) => error instanceof AppError && error.statusCode === 403,
  );
  assert.throws(
    () => assertPurchaseOrderTransition({ status: "ISSUED", actor: "SUPPLIER", action: "CANCEL" }),
    (error) => error instanceof AppError && error.statusCode === 403,
  );
});
