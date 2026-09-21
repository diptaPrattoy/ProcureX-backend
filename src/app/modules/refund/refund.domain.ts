import { AppError } from "../../errors/AppError.js";

export type RefundLifecycleStatus =
  | "REQUESTED"
  | "APPROVED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

export const ACTIVE_REFUND_STATUSES: RefundLifecycleStatus[] = [
  "REQUESTED",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
];

export const assertPaymentCanBeRefunded = (status: string) => {
  if (status === "REFUNDED") {
    throw new AppError(409, "Payment has already been fully refunded");
  }
  if (status !== "SUCCEEDED") {
    throw new AppError(409, "Only a successful payment can be refunded");
  }
};

export const assertRefundCanBeCancelled = (status: RefundLifecycleStatus) => {
  if (status !== "REQUESTED") {
    throw new AppError(409, "Only a pending refund request can be cancelled");
  }
};

export const assertRefundCanBeReviewed = (status: RefundLifecycleStatus) => {
  if (status !== "REQUESTED") {
    throw new AppError(409, "Only a pending refund request can be reviewed");
  }
};

export const mapStripeRefundStatus = (status: string): RefundLifecycleStatus => {
  switch (status) {
    case "succeeded":
      return "SUCCEEDED";
    case "pending":
    case "requires_action":
      return "PROCESSING";
    case "failed":
      return "FAILED";
    case "canceled":
      return "CANCELLED";
    default:
      return "PROCESSING";
  }
};

export const fromStripeMinorUnits = (amount: number, currency: string): string => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new AppError(500, "Invalid refund amount from payment provider");
  }

  const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
    "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
  ]);
  const normalized = currency.trim().toUpperCase();
  return zeroDecimalCurrencies.has(normalized) ? String(amount) : (amount / 100).toFixed(2);
};
