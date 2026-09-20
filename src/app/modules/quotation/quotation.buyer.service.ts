import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import {
  assertCanStartEvaluation,
  assertQuotationCanBeAwarded,
  buildPurchaseOrderItems,
} from "./quotation.award.domain.js";
import type { BuyerQuotationListQuery } from "./quotation.validation.js";

const buyerQuotationListSelect = {
  id: true,
  rfqId: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  deliveryDays: true,
  validUntil: true,
  terms: true,
  notes: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  awardedAt: true,
  supplier: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      supplierProfile: {
        select: {
          id: true,
          companyName: true,
          verificationStatus: true,
          city: true,
          country: true,
        },
      },
    },
  },
  _count: { select: { items: true } },
} as const;

const buyerQuotationDetailSelect = {
  ...buyerQuotationListSelect,
  items: {
    select: {
      id: true,
      rfqItemId: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      notes: true,
      rfqItem: {
        select: {
          itemName: true,
          description: true,
          specifications: true,
          unit: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const purchaseOrderSelect = {
  id: true,
  poNumber: true,
  rfqId: true,
  quotationId: true,
  buyerId: true,
  supplierId: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  shippingAddress: true,
  notes: true,
  status: true,
  issuedAt: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      rfqItemId: true,
      itemName: true,
      description: true,
      specifications: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      lineTotal: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const assertBuyerOwnsRfq = async (buyerId: string, rfqId: string) => {
  const rfq = await prisma.rfq.findFirst({
    where: { id: rfqId, buyerId, deletedAt: null },
    select: { id: true, status: true, title: true },
  });
  if (!rfq) {
    throw new AppError(404, "RFQ not found");
  }
  return rfq;
};

const listForBuyer = async (buyerId: string, rfqId: string, query: BuyerQuotationListQuery) => {
  await assertBuyerOwnsRfq(buyerId, rfqId);

  const where: Prisma.QuotationWhereInput = {
    rfqId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          supplier: {
            supplierProfile: {
              companyName: { contains: query.search, mode: "insensitive" },
            },
          },
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.QuotationOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      select: buyerQuotationListSelect,
      orderBy,
      skip,
      take: query.limit,
    }),
    prisma.quotation.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

const getForBuyer = async (buyerId: string, rfqId: string, quotationId: string) => {
  await assertBuyerOwnsRfq(buyerId, rfqId);
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, rfqId, deletedAt: null },
    select: buyerQuotationDetailSelect,
  });
  if (!quotation) {
    throw new AppError(404, "Quotation not found");
  }
  return quotation;
};

const startEvaluation = async (buyerId: string, rfqId: string, context: AuditContext) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            quotations: {
              where: { status: "SUBMITTED", deletedAt: null },
            },
          },
        },
      },
    });

    if (!rfq) {
      throw new AppError(404, "RFQ not found");
    }
    assertCanStartEvaluation({ status: rfq.status, quotationCount: rfq._count.quotations });

    const reviewedAt = new Date();
    await tx.quotation.updateMany({
      where: { rfqId, status: "SUBMITTED", deletedAt: null },
      data: { status: "UNDER_REVIEW", reviewedAt },
    });

    const updatedRfq = await tx.rfq.update({
      where: { id: rfqId },
      data: { status: "EVALUATING" },
      select: {
        id: true,
        title: true,
        status: true,
        submissionDeadline: true,
        publishedAt: true,
        updatedAt: true,
        _count: { select: { quotations: true } },
      },
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "RFQ_EVALUATION_STARTED",
      entityType: "Rfq",
      entityId: rfqId,
      metadata: { quotationCount: rfq._count.quotations },
      ...context,
    });

    return updatedRfq;
  });
};

const makePoNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PO-${date}-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
};

const buildShippingAddress = (rfq: {
  deliveryAddressLine1: string | null;
  deliveryAddressLine2: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryPostalCode: string | null;
  deliveryCountry: string | null;
}): Prisma.InputJsonObject =>
  ({
    ...(rfq.deliveryAddressLine1 ? { line1: rfq.deliveryAddressLine1 } : {}),
    ...(rfq.deliveryAddressLine2 ? { line2: rfq.deliveryAddressLine2 } : {}),
    ...(rfq.deliveryCity ? { city: rfq.deliveryCity } : {}),
    ...(rfq.deliveryState ? { state: rfq.deliveryState } : {}),
    ...(rfq.deliveryPostalCode ? { postalCode: rfq.deliveryPostalCode } : {}),
    ...(rfq.deliveryCountry ? { country: rfq.deliveryCountry } : {}),
  }) as Prisma.InputJsonObject;

const award = async (
  buyerId: string,
  rfqId: string,
  quotationId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await tx.rfq.findFirst({
      where: { id: rfqId, buyerId, deletedAt: null },
      select: {
        id: true,
        status: true,
        currency: true,
        deliveryAddressLine1: true,
        deliveryAddressLine2: true,
        deliveryCity: true,
        deliveryState: true,
        deliveryPostalCode: true,
        deliveryCountry: true,
        purchaseOrder: { select: { id: true } },
        items: {
          select: {
            id: true,
            itemName: true,
            description: true,
            specifications: true,
            quantity: true,
            unit: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!rfq) {
      throw new AppError(404, "RFQ not found");
    }
    if (rfq.purchaseOrder) {
      throw new AppError(409, "This RFQ has already been awarded");
    }

    const quotation = await tx.quotation.findFirst({
      where: { id: quotationId, rfqId, deletedAt: null },
      select: {
        id: true,
        supplierId: true,
        currency: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        validUntil: true,
        terms: true,
        notes: true,
        status: true,
        supplier: {
          select: {
            status: true,
            deletedAt: true,
            supplierProfile: {
              select: { verificationStatus: true, deletedAt: true },
            },
          },
        },
        items: {
          select: {
            rfqItemId: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new AppError(404, "Quotation not found");
    }
    assertQuotationCanBeAwarded({
      rfqStatus: rfq.status,
      quotationStatus: quotation.status,
      validUntil: quotation.validUntil,
    });

    if (
      quotation.supplier.status !== "ACTIVE" ||
      quotation.supplier.deletedAt ||
      !quotation.supplier.supplierProfile ||
      quotation.supplier.supplierProfile.deletedAt ||
      quotation.supplier.supplierProfile.verificationStatus !== "VERIFIED"
    ) {
      throw new AppError(409, "The selected supplier is no longer eligible for award");
    }
    if (quotation.currency !== rfq.currency) {
      throw new AppError(409, "Quotation currency no longer matches the RFQ");
    }

    const poItems = buildPurchaseOrderItems(
      rfq.items.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        description: item.description,
        specifications: item.specifications,
        quantity: Number(item.quantity),
        unit: item.unit,
      })),
      quotation.items.map((item) => ({
        rfqItemId: item.rfqItemId,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    );

    const awardedAt = new Date();
    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: "AWARDED", awardedAt, reviewedAt: awardedAt },
    });
    await tx.quotation.updateMany({
      where: {
        rfqId,
        id: { not: quotation.id },
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        deletedAt: null,
      },
      data: { status: "REJECTED", reviewedAt: awardedAt },
    });
    await tx.rfq.update({
      where: { id: rfqId },
      data: { status: "AWARDED", awardedAt },
    });

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        poNumber: makePoNumber(),
        rfqId,
        quotationId: quotation.id,
        buyerId,
        supplierId: quotation.supplierId,
        currency: quotation.currency,
        subtotal: quotation.subtotal,
        taxAmount: quotation.taxAmount,
        totalAmount: quotation.totalAmount,
        shippingAddress: buildShippingAddress(rfq),
        notes: quotation.terms ?? quotation.notes,
        items: {
          create: poItems.map((item) => ({
            rfqItemId: item.rfqItemId,
            itemName: item.itemName,
            description: item.description,
            specifications:
              item.specifications === null
                ? undefined
                : (item.specifications as Prisma.InputJsonValue),
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
      select: purchaseOrderSelect,
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "QUOTATION_AWARDED",
      entityType: "Quotation",
      entityId: quotation.id,
      metadata: {
        rfqId,
        purchaseOrderId: purchaseOrder.id,
        supplierId: quotation.supplierId,
        totalAmount: Number(quotation.totalAmount),
        currency: quotation.currency,
      },
      ...context,
    });
    await AuditService.create(tx, {
      actorId: buyerId,
      action: "PURCHASE_ORDER_ISSUED",
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      metadata: {
        poNumber: purchaseOrder.poNumber,
        rfqId,
        quotationId: quotation.id,
      },
      ...context,
    });

    return purchaseOrder;
  });
};

export const BuyerQuotationService = {
  listForBuyer,
  getForBuyer,
  startEvaluation,
  award,
};
