import { AppError } from "../../errors/AppError.js";

export type InvoiceablePurchaseOrderStatus =
  | "ISSUED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "PARTIALLY_DELIVERED"
  | "DELIVERED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type InvoiceSourceItem = {
  id: string;
  unitPrice: number;
  acceptedQuantity: number;
  invoicedQuantity: number;
};

export type InvoiceItemInput = {
  purchaseOrderItemId: string;
  quantity: number;
  description?: string | null;
};

const toMilli = (value: number) => Math.round((value + Number.EPSILON) * 1000);
const fromMilli = (value: number) => value / 1000;
const toCents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const fromCents = (value: number) => value / 100;

export const calculateInvoice = (
  purchaseOrderStatus: InvoiceablePurchaseOrderStatus,
  sourceItems: InvoiceSourceItem[],
  items: InvoiceItemInput[],
  taxAmount: number,
) => {
  if (purchaseOrderStatus !== "PARTIALLY_DELIVERED" && purchaseOrderStatus !== "DELIVERED") {
    throw new AppError(
      409,
      "Invoices can only be submitted for purchase orders with accepted goods",
    );
  }

  if (items.length === 0) {
    throw new AppError(400, "An invoice must contain at least one item");
  }

  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let subtotalCents = 0;

  const normalizedItems = items.map((input) => {
    if (seen.has(input.purchaseOrderItemId)) {
      throw new AppError(400, "A purchase order item can appear only once in an invoice");
    }
    seen.add(input.purchaseOrderItemId);

    const source = sourceById.get(input.purchaseOrderItemId);
    if (!source) {
      throw new AppError(400, "Invoice contains an item that does not belong to this purchase order");
    }

    const requestedMilli = toMilli(input.quantity);
    const acceptedMilli = toMilli(source.acceptedQuantity);
    const invoicedMilli = toMilli(source.invoicedQuantity);
    const remainingMilli = acceptedMilli - invoicedMilli;

    if (requestedMilli <= 0) {
      throw new AppError(400, "Invoice quantity must be greater than zero");
    }
    if (remainingMilli <= 0) {
      throw new AppError(409, "This purchase order item has no accepted quantity left to invoice");
    }
    if (requestedMilli > remainingMilli) {
      throw new AppError(409, "Invoice quantity exceeds the remaining accepted quantity");
    }

    const quantity = fromMilli(requestedMilli);
    const unitPriceCents = toCents(source.unitPrice);
    const lineTotalCents = Math.round((unitPriceCents * requestedMilli) / 1000);
    subtotalCents += lineTotalCents;

    return {
      purchaseOrderItemId: input.purchaseOrderItemId,
      description: input.description,
      quantity,
      unitPrice: fromCents(unitPriceCents),
      lineTotal: fromCents(lineTotalCents),
    };
  });

  const taxCents = toCents(taxAmount);
  if (taxCents < 0) {
    throw new AppError(400, "Tax amount cannot be negative");
  }
  if (taxCents > subtotalCents) {
    throw new AppError(400, "Tax amount cannot exceed the invoice subtotal");
  }

  return {
    subtotal: fromCents(subtotalCents),
    taxAmount: fromCents(taxCents),
    totalAmount: fromCents(subtotalCents + taxCents),
    items: normalizedItems,
  } as const;
};

export const assertInvoiceCancellationAllowed = (status: string) => {
  if (status !== "SUBMITTED") {
    throw new AppError(409, "Only submitted invoices can be cancelled by the supplier");
  }
};
