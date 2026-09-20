import { AppError } from "../../errors/AppError.js";

export type EvaluationRfqState = {
  status: string;
  quotationCount: number;
};

export type AwardableQuotationState = {
  rfqStatus: string;
  quotationStatus: string;
  validUntil: Date;
};

export type PurchaseOrderRfqItemSnapshot = {
  id: string;
  itemName: string;
  description: string | null;
  specifications: unknown;
  quantity: number;
  unit: string;
};

export type PurchaseOrderQuotationItemSnapshot = {
  rfqItemId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const assertCanStartEvaluation = ({ status, quotationCount }: EvaluationRfqState) => {
  if (status !== "OPEN") {
    throw new AppError(409, "Only open RFQs can enter evaluation");
  }
  if (quotationCount < 1) {
    throw new AppError(409, "At least one active quotation is required to start evaluation");
  }
};

export const assertQuotationCanBeAwarded = (
  state: AwardableQuotationState,
  now = new Date(),
) => {
  if (state.rfqStatus !== "EVALUATING") {
    throw new AppError(409, "RFQ must be in evaluation before awarding a quotation");
  }
  if (state.quotationStatus !== "UNDER_REVIEW") {
    throw new AppError(409, "Only a quotation under review can be awarded");
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const validThrough = new Date(
    Date.UTC(
      state.validUntil.getUTCFullYear(),
      state.validUntil.getUTCMonth(),
      state.validUntil.getUTCDate(),
    ),
  );

  if (validThrough < today) {
    throw new AppError(409, "The selected quotation is no longer valid");
  }
};

export const buildPurchaseOrderItems = (
  rfqItems: PurchaseOrderRfqItemSnapshot[],
  quotationItems: PurchaseOrderQuotationItemSnapshot[],
) => {
  if (rfqItems.length !== quotationItems.length) {
    throw new AppError(409, "Quotation no longer matches the RFQ line items");
  }

  const quotedByRfqItem = new Map(quotationItems.map((item) => [item.rfqItemId, item]));
  if (quotedByRfqItem.size !== quotationItems.length) {
    throw new AppError(409, "Quotation contains duplicate RFQ line items");
  }

  return rfqItems.map((rfqItem) => {
    const quoted = quotedByRfqItem.get(rfqItem.id);
    if (!quoted) {
      throw new AppError(409, "Quotation no longer matches the RFQ line items");
    }
    if (quoted.quantity !== rfqItem.quantity) {
      throw new AppError(409, "Quotation quantity no longer matches the RFQ");
    }

    return {
      rfqItemId: rfqItem.id,
      itemName: rfqItem.itemName,
      description: rfqItem.description,
      specifications: rfqItem.specifications,
      quantity: rfqItem.quantity,
      unit: rfqItem.unit,
      unitPrice: quoted.unitPrice,
      lineTotal: quoted.lineTotal,
    };
  });
};
