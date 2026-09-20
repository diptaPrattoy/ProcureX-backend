import { AppError } from "../../errors/AppError.js";

export type QuoteableRfqItem = {
  id: string;
  quantity: number;
};

export type QuotationPriceInput = {
  rfqItemId: string;
  unitPrice: number;
  notes?: string | null;
};

const toScaledInteger = (value: number, scale: number) => {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor);
};

const fromCents = (value: number) => value / 100;

export const calculateQuotationPricing = (
  rfqItems: QuoteableRfqItem[],
  priceInputs: QuotationPriceInput[],
  taxAmount: number,
) => {
  if (rfqItems.length !== priceInputs.length) {
    throw new AppError(400, "Quotation must price every RFQ item exactly once");
  }

  const inputByItemId = new Map<string, QuotationPriceInput>();
  for (const item of priceInputs) {
    if (inputByItemId.has(item.rfqItemId)) {
      throw new AppError(400, "Quotation contains a duplicate RFQ item");
    }
    inputByItemId.set(item.rfqItemId, item);
  }

  let subtotalCents = 0;
  const items = rfqItems.map((rfqItem) => {
    const input = inputByItemId.get(rfqItem.id);
    if (!input) {
      throw new AppError(400, "Quotation must price every RFQ item exactly once");
    }

    const quantityMilli = toScaledInteger(rfqItem.quantity, 3);
    const unitPriceCents = toScaledInteger(input.unitPrice, 2);
    const lineTotalCents = Math.round((quantityMilli * unitPriceCents) / 1000);
    subtotalCents += lineTotalCents;

    return {
      rfqItemId: rfqItem.id,
      quantity: rfqItem.quantity,
      unitPrice: fromCents(unitPriceCents),
      lineTotal: fromCents(lineTotalCents),
      notes: input.notes,
    };
  });

  const taxCents = toScaledInteger(taxAmount, 2);

  return {
    subtotal: fromCents(subtotalCents),
    taxAmount: fromCents(taxCents),
    totalAmount: fromCents(subtotalCents + taxCents),
    items,
  };
};

export const assertQuotationValidityWindow = (
  validUntil: Date,
  submissionDeadline: Date,
  now = new Date(),
) => {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const deadlineDay = new Date(
    Date.UTC(
      submissionDeadline.getUTCFullYear(),
      submissionDeadline.getUTCMonth(),
      submissionDeadline.getUTCDate(),
    ),
  );

  if (validUntil < today) {
    throw new AppError(400, "Quotation validity date cannot be in the past");
  }

  if (validUntil < deadlineDay) {
    throw new AppError(400, "Quotation must remain valid through the RFQ submission deadline");
  }
};
