import type {
  DisputeStatus,
  InvoiceStatus,
  PurchaseOrderStatus,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";

export const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = [
  "OPEN",
  "UNDER_REVIEW",
];

const DISPUTABLE_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  "ACCEPTED",
  "IN_PROGRESS",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "COMPLETED",
];

const DISPUTABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAYMENT_PENDING",
  "PAID",
];

export const assertPurchaseOrderCanBeDisputed = (
  status: PurchaseOrderStatus,
) => {
  if (!DISPUTABLE_PURCHASE_ORDER_STATUSES.includes(status)) {
    throw new AppError(
      409,
      `Purchase order cannot be disputed while ${status}`,
    );
  }
};

export const assertInvoiceCanBeDisputed = (status: InvoiceStatus) => {
  if (!DISPUTABLE_INVOICE_STATUSES.includes(status)) {
    throw new AppError(409, `Invoice cannot be disputed while ${status}`);
  }
};

export const assertDisputeCanEnterReview = (status: DisputeStatus) => {
  if (status !== "OPEN") {
    throw new AppError(409, "Only open disputes can enter review");
  }
};

export const assertDisputeCanBeFinalized = (status: DisputeStatus) => {
  if (status !== "UNDER_REVIEW") {
    throw new AppError(409, "Only disputes under review can be finalized");
  }
};
