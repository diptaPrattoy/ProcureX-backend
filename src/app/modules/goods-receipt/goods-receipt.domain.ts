import { AppError } from "../../errors/AppError.js";

export type ReceivablePurchaseOrderStatus =
  | "IN_PROGRESS"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "ISSUED"
  | "ACCEPTED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export type ReceiptStatus = "ACCEPTED" | "PARTIALLY_ACCEPTED" | "REJECTED";

export type OrderedReceiptItem = {
  id: string;
  orderedQuantity: number;
  acceptedToDate: number;
};

export type ReceiptItemInput = {
  purchaseOrderItemId: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  notes?: string | null;
};

const toMilli = (value: number) => Math.round((value + Number.EPSILON) * 1000);
const fromMilli = (value: number) => value / 1000;

export const evaluateGoodsReceipt = (
  purchaseOrderStatus: ReceivablePurchaseOrderStatus,
  orderedItems: OrderedReceiptItem[],
  receiptItems: ReceiptItemInput[],
) => {
  if (
    purchaseOrderStatus !== "IN_PROGRESS" &&
    purchaseOrderStatus !== "PARTIALLY_DELIVERED"
  ) {
    throw new AppError(
      409,
      "Goods can only be received after fulfillment has started and before delivery is complete",
    );
  }

  if (receiptItems.length === 0) {
    throw new AppError(400, "A goods receipt must contain at least one item");
  }

  const orderedById = new Map(orderedItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let totalReceivedMilli = 0;
  let totalAcceptedThisReceiptMilli = 0;
  let totalRejectedThisReceiptMilli = 0;

  const normalizedItems = receiptItems.map((input) => {
    if (seen.has(input.purchaseOrderItemId)) {
      throw new AppError(
        400,
        "A purchase order item can appear only once in a goods receipt",
      );
    }
    seen.add(input.purchaseOrderItemId);

    const orderedItem = orderedById.get(input.purchaseOrderItemId);
    if (!orderedItem) {
      throw new AppError(
        400,
        "Goods receipt contains an item that does not belong to this purchase order",
      );
    }

    const receivedMilli = toMilli(input.quantityReceived);
    const acceptedMilli = toMilli(input.quantityAccepted);
    const rejectedMilli = toMilli(input.quantityRejected);
    const orderedMilli = toMilli(orderedItem.orderedQuantity);
    const acceptedToDateMilli = toMilli(orderedItem.acceptedToDate);

    if (receivedMilli <= 0) {
      throw new AppError(400, "Received quantity must be greater than zero");
    }
    if (acceptedMilli < 0 || rejectedMilli < 0) {
      throw new AppError(
        400,
        "Accepted and rejected quantities cannot be negative",
      );
    }
    if (acceptedMilli + rejectedMilli !== receivedMilli) {
      throw new AppError(
        400,
        "Accepted plus rejected quantity must equal received quantity",
      );
    }

    const remainingMilli = orderedMilli - acceptedToDateMilli;
    if (remainingMilli <= 0) {
      throw new AppError(
        409,
        "This purchase order item has already been fully accepted",
      );
    }
    if (receivedMilli > remainingMilli) {
      throw new AppError(
        409,
        "Received quantity exceeds the remaining purchase order quantity",
      );
    }

    totalReceivedMilli += receivedMilli;
    totalAcceptedThisReceiptMilli += acceptedMilli;
    totalRejectedThisReceiptMilli += rejectedMilli;

    return {
      purchaseOrderItemId: input.purchaseOrderItemId,
      quantityReceived: fromMilli(receivedMilli),
      quantityAccepted: fromMilli(acceptedMilli),
      quantityRejected: fromMilli(rejectedMilli),
      notes: input.notes,
    };
  });

  const receiptStatus: ReceiptStatus =
    totalAcceptedThisReceiptMilli === totalReceivedMilli
      ? "ACCEPTED"
      : totalRejectedThisReceiptMilli === totalReceivedMilli
        ? "REJECTED"
        : "PARTIALLY_ACCEPTED";

  const receiptAcceptedByItem = new Map(
    normalizedItems.map((item) => [
      item.purchaseOrderItemId,
      toMilli(item.quantityAccepted),
    ]),
  );

  let anyAccepted = false;
  let allFulfilled = true;
  for (const item of orderedItems) {
    const orderedMilli = toMilli(item.orderedQuantity);
    const acceptedAfterMilli =
      toMilli(item.acceptedToDate) + (receiptAcceptedByItem.get(item.id) ?? 0);

    if (acceptedAfterMilli > 0) {
      anyAccepted = true;
    }
    if (acceptedAfterMilli < orderedMilli) {
      allFulfilled = false;
    }
  }

  const nextPurchaseOrderStatus = allFulfilled
    ? "DELIVERED"
    : anyAccepted
      ? "PARTIALLY_DELIVERED"
      : "IN_PROGRESS";

  return {
    receiptStatus,
    nextPurchaseOrderStatus,
    items: normalizedItems,
  } as const;
};
