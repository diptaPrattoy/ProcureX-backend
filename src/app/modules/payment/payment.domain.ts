import { AppError } from "../../errors/AppError.js";

export type PayableInvoiceStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "CANCELLED";

export type PaymentLifecycleStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

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

export const assertInvoiceCanEnterPayment = (status: PayableInvoiceStatus) => {
  if (status !== "APPROVED" && status !== "PAYMENT_PENDING") {
    if (status === "PAID") {
      throw new AppError(409, "Invoice has already been paid");
    }
    throw new AppError(409, "Only an approved invoice can be paid");
  }
};

export const isReusableCheckoutStatus = (status: PaymentLifecycleStatus) =>
  status === "PENDING" || status === "PROCESSING";

export const isTerminalPaymentStatus = (status: PaymentLifecycleStatus) =>
  status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED" || status === "REFUNDED";

export const toStripeMinorUnits = (amount: string | number, currency: string): number => {
  const normalizedCurrency = currency.trim().toUpperCase();
  const decimals = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency) ? 0 : 2;
  const normalizedAmount = typeof amount === "number" ? amount.toFixed(2) : amount.trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalizedAmount)) {
    throw new AppError(500, "Invalid invoice amount for payment provider");
  }

  const [whole, fraction = ""] = normalizedAmount.split(".");
  if (decimals === 0) {
    if (Number(fraction || "0") !== 0) {
      throw new AppError(500, `${normalizedCurrency} payments cannot contain decimal amounts`);
    }
    const units = Number(whole);
    if (!Number.isSafeInteger(units) || units <= 0) {
      throw new AppError(500, "Invoice amount is outside the supported payment range");
    }
    return units;
  }

  const paddedFraction = `${fraction}00`.slice(0, 2);
  if (fraction.length > 2 && Number(fraction.slice(2)) !== 0) {
    throw new AppError(500, "Invoice amount has unsupported decimal precision");
  }

  const units = Number(whole) * 100 + Number(paddedFraction);
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new AppError(500, "Invoice amount is outside the supported payment range");
  }
  return units;
};
