import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import {
  assertCanStartEvaluation,
  assertQuotationCanBeAwarded,
  buildPurchaseOrderItems,
} from "../src/app/modules/quotation/quotation.award.domain.js";

test("evaluation requires an open RFQ with at least one quotation", () => {
  assert.doesNotThrow(() => assertCanStartEvaluation({ status: "OPEN", quotationCount: 2 }));
  assert.throws(
    () => assertCanStartEvaluation({ status: "DRAFT", quotationCount: 2 }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
  assert.throws(
    () => assertCanStartEvaluation({ status: "OPEN", quotationCount: 0 }),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("award requires evaluation state, under-review quote and current validity", () => {
  const now = new Date("2026-09-21T08:00:00.000Z");
  assert.doesNotThrow(() =>
    assertQuotationCanBeAwarded(
      {
        rfqStatus: "EVALUATING",
        quotationStatus: "UNDER_REVIEW",
        validUntil: new Date("2026-09-21T00:00:00.000Z"),
      },
      now,
    ),
  );

  assert.throws(
    () =>
      assertQuotationCanBeAwarded(
        {
          rfqStatus: "OPEN",
          quotationStatus: "UNDER_REVIEW",
          validUntil: new Date("2026-10-01T00:00:00.000Z"),
        },
        now,
      ),
    (error) => error instanceof AppError && error.statusCode === 409,
  );

  assert.throws(
    () =>
      assertQuotationCanBeAwarded(
        {
          rfqStatus: "EVALUATING",
          quotationStatus: "UNDER_REVIEW",
          validUntil: new Date("2026-09-20T00:00:00.000Z"),
        },
        now,
      ),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});

test("purchase-order items are immutable snapshots of RFQ and quotation data", () => {
  const result = buildPurchaseOrderItems(
    [
      {
        id: "11111111-1111-4111-8111-111111111111",
        itemName: "Business Laptop",
        description: "14-inch laptop",
        specifications: { ram: "16GB" },
        quantity: 20,
        unit: "piece",
      },
    ],
    [
      {
        rfqItemId: "11111111-1111-4111-8111-111111111111",
        quantity: 20,
        unitPrice: 650,
        lineTotal: 13000,
      },
    ],
  );

  assert.deepEqual(result[0], {
    rfqItemId: "11111111-1111-4111-8111-111111111111",
    itemName: "Business Laptop",
    description: "14-inch laptop",
    specifications: { ram: "16GB" },
    quantity: 20,
    unit: "piece",
    unitPrice: 650,
    lineTotal: 13000,
  });
});

test("purchase-order snapshot rejects missing or changed quote quantities", () => {
  const rfq = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      itemName: "Laptop",
      description: null,
      specifications: null,
      quantity: 20,
      unit: "piece",
    },
  ];

  assert.throws(
    () => buildPurchaseOrderItems(rfq, []),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
  assert.throws(
    () =>
      buildPurchaseOrderItems(rfq, [
        {
          rfqItemId: rfq[0]!.id,
          quantity: 19,
          unitPrice: 650,
          lineTotal: 12350,
        },
      ]),
    (error) => error instanceof AppError && error.statusCode === 409,
  );
});
