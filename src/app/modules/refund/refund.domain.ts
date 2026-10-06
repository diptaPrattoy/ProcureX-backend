import { AppError } from "../../errors/AppError.js";

export { fromStripeMinorUnits } from "../payment/payment.domain.js";

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

export const mapStripeRefundStatus = (
  status: string,
): RefundLifecycleStatus => {
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

const TERMINAL_REFUND_STATUSES = new Set<RefundLifecycleStatus>([
  "SUCCEEDED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
]);

export const canApplyProviderRefundStatus = (
  current: RefundLifecycleStatus,
  next: RefundLifecycleStatus,
) => current !== next && !TERMINAL_REFUND_STATUSES.has(current);
