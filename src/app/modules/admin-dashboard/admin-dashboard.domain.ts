import { toStripeMinorUnits } from "../payment/payment.domain.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

type DashboardRangeInput = {
  from?: Date;
  to?: Date;
  days: number;
};

export const resolveDashboardRange = (input: DashboardRangeInput, now = new Date()) => {
  const to = input.to ?? now;
  const from = input.from ?? new Date(to.getTime() - input.days * DAY_MS);
  return { from, to };
};

export const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export type TrendSeries = Record<string, Date[]>;
type TrendBucket = { date: string; [metric: string]: string | number };

export const buildDailyTrendBuckets = (days: number, now: Date, series: TrendSeries) => {
  const end = startOfUtcDay(now);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const buckets = new Map<string, TrendBucket>();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getTime() + index * DAY_MS);
    const key = dateKey(date);
    buckets.set(key, { date: key });
  }

  for (const [metric, dates] of Object.entries(series)) {
    for (const date of dates) {
      const key = dateKey(date);
      const bucket = buckets.get(key);
      if (bucket) {
        const current = typeof bucket[metric] === "number" ? bucket[metric] : 0;
        bucket[metric] = current + 1;
      }
    }
  }

  const metricNames = Object.keys(series);
  return [...buckets.values()].map((bucket) => {
    for (const metric of metricNames) bucket[metric] ??= 0;
    return bucket;
  });
};

type CurrencyAggregate = {
  currency: string;
  amount: { toString(): string } | string | number | null;
  count: number;
};

const formatMinorUnits = (amount: number, currency: string) => {
  const normalized = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(normalized)) return String(amount);
  return (amount / 100).toFixed(2);
};

const toMinor = (row?: CurrencyAggregate) => {
  if (!row?.amount) return 0;
  return toStripeMinorUnits(row.amount.toString(), row.currency);
};

export const buildFinancialCurrencySummary = (
  grossRows: CurrencyAggregate[],
  refundRows: CurrencyAggregate[],
  outstandingRows: CurrencyAggregate[],
) => {
  const currencies = new Set<string>();
  for (const row of [...grossRows, ...refundRows, ...outstandingRows]) {
    currencies.add(row.currency.toUpperCase());
  }

  const byCurrency = (rows: CurrencyAggregate[], currency: string) =>
    rows.find((row) => row.currency.toUpperCase() === currency);

  return [...currencies]
    .sort()
    .map((currency) => {
      const gross = byCurrency(grossRows, currency);
      const refunds = byCurrency(refundRows, currency);
      const outstanding = byCurrency(outstandingRows, currency);
      const grossMinor = toMinor(gross);
      const refundMinor = toMinor(refunds);
      const outstandingMinor = toMinor(outstanding);
      const netMinor = grossMinor - refundMinor;

      return {
        currency,
        grossCollected: formatMinorUnits(grossMinor, currency),
        successfulPaymentCount: gross?.count ?? 0,
        refunded: formatMinorUnits(refundMinor, currency),
        successfulRefundCount: refunds?.count ?? 0,
        netCashFlow: formatMinorUnits(netMinor, currency),
        outstandingApproved: formatMinorUnits(outstandingMinor, currency),
        outstandingInvoiceCount: outstanding?.count ?? 0,
      };
    });
};

export const countByKey = <T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
): Record<string, number> => {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const value = String(row[key]);
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
};
