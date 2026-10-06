import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/app/errors/AppError.js";
import {
  assertQuotationValidityWindow,
  calculateQuotationPricing,
} from "../src/app/modules/quotation/quotation.domain.js";
import { submitQuotationSchema } from "../src/app/modules/quotation/quotation.validation.js";

test("quotation pricing uses RFQ quantities and computes server totals", () => {
  const result = calculateQuotationPricing(
    [
      { id: "11111111-1111-4111-8111-111111111111", quantity: 20 },
      { id: "22222222-2222-4222-8222-222222222222", quantity: 20 },
    ],
    [
      { rfqItemId: "11111111-1111-4111-8111-111111111111", unitPrice: 650 },
      { rfqItemId: "22222222-2222-4222-8222-222222222222", unitPrice: 120.5 },
    ],
    770.5,
  );

  assert.equal(result.subtotal, 15410);
  assert.equal(result.taxAmount, 770.5);
  assert.equal(result.totalAmount, 16180.5);
  assert.deepEqual(
    result.items.map((item) => item.lineTotal),
    [13000, 2410],
  );
});

test("quotation rejects missing or duplicate RFQ item prices", () => {
  const rfqItems = [
    { id: "11111111-1111-4111-8111-111111111111", quantity: 2 },
    { id: "22222222-2222-4222-8222-222222222222", quantity: 3 },
  ];

  assert.throws(
    () =>
      calculateQuotationPricing(
        rfqItems,
        [
          {
            rfqItemId: "11111111-1111-4111-8111-111111111111",
            unitPrice: 10,
          },
        ],
        0,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );

  assert.throws(
    () =>
      calculateQuotationPricing(
        rfqItems,
        [
          {
            rfqItemId: "11111111-1111-4111-8111-111111111111",
            unitPrice: 10,
          },
          {
            rfqItemId: "11111111-1111-4111-8111-111111111111",
            unitPrice: 20,
          },
        ],
        0,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test("quotation validity must cover the RFQ submission deadline", () => {
  const now = new Date("2026-09-21T04:00:00.000Z");
  const deadline = new Date("2026-09-28T18:00:00.000Z");

  assert.doesNotThrow(() =>
    assertQuotationValidityWindow(
      new Date("2026-09-28T00:00:00.000Z"),
      deadline,
      now,
    ),
  );

  assert.throws(
    () =>
      assertQuotationValidityWindow(
        new Date("2026-09-27T00:00:00.000Z"),
        deadline,
        now,
      ),
    (error) => error instanceof AppError && error.statusCode === 400,
  );
});

test("submission validation normalizes currency and rejects invalid prices", () => {
  const parsed = submitQuotationSchema.parse({
    currency: "usd",
    taxAmount: 0,
    deliveryDays: 14,
    validUntil: "2026-10-01",
    items: [
      {
        rfqItemId: "11111111-1111-4111-8111-111111111111",
        unitPrice: 25.5,
      },
    ],
  });

  assert.equal(parsed.currency, "USD");
  assert.equal(parsed.items[0]?.unitPrice, 25.5);

  assert.equal(
    submitQuotationSchema.safeParse({
      currency: "ABC",
      deliveryDays: 14,
      validUntil: "2026-10-01",
      items: [
        {
          rfqItemId: "11111111-1111-4111-8111-111111111111",
          unitPrice: 25.5,
        },
      ],
    }).success,
    false,
  );

  assert.equal(
    submitQuotationSchema.safeParse({
      currency: "USD",
      deliveryDays: 14,
      validUntil: "2026-10-01",
      items: [
        {
          rfqItemId: "11111111-1111-4111-8111-111111111111",
          unitPrice: 0,
        },
      ],
    }).success,
    false,
  );
});
