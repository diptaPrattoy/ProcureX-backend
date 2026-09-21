import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDailyTrendBuckets,
  buildFinancialCurrencySummary,
  countByKey,
  resolveDashboardRange,
} from "../src/app/modules/admin-dashboard/admin-dashboard.domain.js";

test("dashboard range uses the requested rolling-day window", () => {
  const now = new Date("2026-09-21T12:00:00.000Z");
  const range = resolveDashboardRange({ days: 30 }, now);
  assert.equal(range.to.toISOString(), now.toISOString());
  assert.equal(range.from.toISOString(), "2026-08-22T12:00:00.000Z");
});

test("daily trend buckets fill missing metrics with zero", () => {
  const buckets = buildDailyTrendBuckets(3, new Date("2026-09-21T18:00:00.000Z"), {
    rfqs: [new Date("2026-09-20T10:00:00.000Z")],
    payments: [
      new Date("2026-09-19T01:00:00.000Z"),
      new Date("2026-09-19T22:00:00.000Z"),
    ],
  });

  assert.deepEqual(buckets, [
    { date: "2026-09-19", rfqs: 0, payments: 2 },
    { date: "2026-09-20", rfqs: 1, payments: 0 },
    { date: "2026-09-21", rfqs: 0, payments: 0 },
  ]);
});

test("financial summary keeps currencies separate and calculates net collection", () => {
  const result = buildFinancialCurrencySummary(
    [
      { currency: "USD", amount: "1000.00", count: 2 },
      { currency: "JPY", amount: "5000", count: 1 },
    ],
    [{ currency: "USD", amount: "125.50", count: 1 }],
    [{ currency: "USD", amount: "300.00", count: 1 }],
  );

  assert.deepEqual(result, [
    {
      currency: "JPY",
      grossCollected: "5000",
      successfulPaymentCount: 1,
      refunded: "0",
      successfulRefundCount: 0,
      netCashFlow: "5000",
      outstandingApproved: "0",
      outstandingInvoiceCount: 0,
    },
    {
      currency: "USD",
      grossCollected: "1000.00",
      successfulPaymentCount: 2,
      refunded: "125.50",
      successfulRefundCount: 1,
      netCashFlow: "874.50",
      outstandingApproved: "300.00",
      outstandingInvoiceCount: 1,
    },
  ]);
});

test("countByKey creates deterministic grouped counts", () => {
  assert.deepEqual(
    countByKey(
      [
        { role: "BUYER" },
        { role: "BUYER" },
        { role: "SUPPLIER" },
      ],
      "role",
    ),
    { BUYER: 2, SUPPLIER: 1 },
  );
});
