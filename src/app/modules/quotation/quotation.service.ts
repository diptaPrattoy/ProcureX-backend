import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import {
  assertQuotationValidityWindow,
  calculateQuotationPricing,
} from "./quotation.domain.js";
import type {
  MyQuotationListQuery,
  SubmitQuotationInput,
  UpdateQuotationInput,
} from "./quotation.validation.js";

const quotationDetailSelect = {
  id: true,
  rfqId: true,
  supplierId: true,
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
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
  rfq: {
    select: {
      id: true,
      title: true,
      status: true,
      currency: true,
      submissionDeadline: true,
      expectedDeliveryDate: true,
      category: { select: { id: true, name: true, slug: true } },
      buyer: {
        select: {
          buyerProfile: { select: { companyName: true } },
        },
      },
    },
  },
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

const quotationListSelect = {
  id: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  deliveryDays: true,
  validUntil: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  rfq: {
    select: {
      id: true,
      title: true,
      status: true,
      submissionDeadline: true,
      buyer: {
        select: { buyerProfile: { select: { companyName: true } } },
      },
      category: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

type QuotationDb = Prisma.TransactionClient;

const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const assertOpenRfq = (rfq: { status: string; submissionDeadline: Date }) => {
  if (rfq.status !== "OPEN") {
    throw new AppError(409, "Quotations can only be submitted or changed while the RFQ is open");
  }
  if (rfq.submissionDeadline <= new Date()) {
    throw new AppError(409, "The RFQ submission deadline has passed");
  }
};

const assertSupplierEligible = async (tx: QuotationDb, supplierId: string, categoryId: string) => {
  const supplier = await tx.user.findFirst({
    where: {
      id: supplierId,
      role: "SUPPLIER",
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      emailVerifiedAt: true,
      supplierProfile: {
        select: {
          id: true,
          verificationStatus: true,
          deletedAt: true,
          categories: {
            where: { categoryId },
            select: { id: true },
          },
        },
      },
    },
  });

  if (!supplier?.supplierProfile || supplier.supplierProfile.deletedAt) {
    throw new AppError(403, "Complete your supplier profile before submitting quotations");
  }
  if (!supplier.emailVerifiedAt) {
    throw new AppError(403, "Verify your email before submitting quotations");
  }
  if (supplier.supplierProfile.verificationStatus !== "VERIFIED") {
    throw new AppError(403, "Only verified suppliers can submit quotations");
  }
  if (supplier.supplierProfile.categories.length === 0) {
    throw new AppError(403, "This RFQ is outside your verified procurement categories");
  }
};

const loadQuoteableRfq = async (tx: QuotationDb, rfqId: string) => {
  const rfq = await tx.rfq.findFirst({
    where: { id: rfqId, deletedAt: null },
    select: {
      id: true,
      categoryId: true,
      currency: true,
      status: true,
      submissionDeadline: true,
      items: {
        select: { id: true, quantity: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!rfq) {
    throw new AppError(404, "RFQ not found");
  }
  assertOpenRfq(rfq);
  return rfq;
};

const submit = async (
  supplierId: string,
  rfqId: string,
  input: SubmitQuotationInput,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const rfq = await loadQuoteableRfq(tx, rfqId);
    await assertSupplierEligible(tx, supplierId, rfq.categoryId);

    if (input.currency !== rfq.currency) {
      throw new AppError(400, `Quotation currency must match the RFQ currency (${rfq.currency})`);
    }

    const existing = await tx.quotation.findUnique({
      where: { rfqId_supplierId: { rfqId, supplierId } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new AppError(409, "You have already submitted a quotation for this RFQ");
    }

    const validUntil = toDateOnly(input.validUntil);
    assertQuotationValidityWindow(validUntil, rfq.submissionDeadline);

    const pricing = calculateQuotationPricing(
      rfq.items.map((item) => ({ id: item.id, quantity: Number(item.quantity) })),
      input.items,
      input.taxAmount,
    );

    const quotation = await tx.quotation.create({
      data: {
        rfqId,
        supplierId,
        currency: input.currency,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        deliveryDays: input.deliveryDays,
        validUntil,
        terms: input.terms,
        notes: input.notes,
        items: {
          create: pricing.items.map((item) => ({
            rfqItemId: item.rfqItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            notes: item.notes,
          })),
        },
      },
      select: quotationDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: supplierId,
      action: "QUOTATION_SUBMITTED",
      entityType: "Quotation",
      entityId: quotation.id,
      metadata: {
        rfqId,
        currency: input.currency,
        totalAmount: pricing.totalAmount,
        itemCount: pricing.items.length,
      },
      ...context,
    });

    return quotation;
  });
};

const listMine = async (supplierId: string, query: MyQuotationListQuery) => {
  const where: Prisma.QuotationWhereInput = {
    supplierId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          rfq: {
            title: { contains: query.search, mode: "insensitive" },
          },
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const orderBy = { [query.sortBy]: query.sortOrder } as Prisma.QuotationOrderByWithRelationInput;

  const [items, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      select: quotationListSelect,
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

const getMineById = async (supplierId: string, quotationId: string) => {
  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, supplierId, deletedAt: null },
    select: quotationDetailSelect,
  });

  if (!quotation) {
    throw new AppError(404, "Quotation not found");
  }
  return quotation;
};

const update = async (
  supplierId: string,
  quotationId: string,
  input: UpdateQuotationInput,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quotation.findFirst({
      where: { id: quotationId, supplierId, deletedAt: null },
      select: {
        id: true,
        status: true,
        currency: true,
        taxAmount: true,
        deliveryDays: true,
        validUntil: true,
        terms: true,
        notes: true,
        rfq: {
          select: {
            id: true,
            categoryId: true,
            currency: true,
            status: true,
            submissionDeadline: true,
            items: {
              select: { id: true, quantity: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
        items: {
          select: { rfqItemId: true, unitPrice: true, notes: true },
        },
      },
    });

    if (!current) {
      throw new AppError(404, "Quotation not found");
    }
    if (current.status !== "SUBMITTED") {
      throw new AppError(409, "Only submitted quotations can be edited");
    }
    assertOpenRfq(current.rfq);
    await assertSupplierEligible(tx, supplierId, current.rfq.categoryId);

    const currency = input.currency ?? current.currency;
    if (currency !== current.rfq.currency) {
      throw new AppError(400, `Quotation currency must match the RFQ currency (${current.rfq.currency})`);
    }

    const validUntil = input.validUntil ? toDateOnly(input.validUntil) : current.validUntil;
    assertQuotationValidityWindow(validUntil, current.rfq.submissionDeadline);

    const priceInputs = input.items ?? current.items.map((item) => ({
      rfqItemId: item.rfqItemId,
      unitPrice: Number(item.unitPrice),
      notes: item.notes,
    }));
    const taxAmount = input.taxAmount ?? Number(current.taxAmount);
    const pricing = calculateQuotationPricing(
      current.rfq.items.map((item) => ({ id: item.id, quantity: Number(item.quantity) })),
      priceInputs,
      taxAmount,
    );

    if (input.items) {
      await tx.quotationItem.deleteMany({ where: { quotationId } });
    }

    const quotation = await tx.quotation.update({
      where: { id: quotationId },
      data: {
        currency,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        deliveryDays: input.deliveryDays,
        validUntil: input.validUntil ? validUntil : undefined,
        terms: input.terms,
        notes: input.notes,
        ...(input.items
          ? {
              items: {
                create: pricing.items.map((item) => ({
                  rfqItemId: item.rfqItemId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                  notes: item.notes,
                })),
              },
            }
          : {}),
      },
      select: quotationDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: supplierId,
      action: "QUOTATION_UPDATED",
      entityType: "Quotation",
      entityId: quotationId,
      metadata: {
        rfqId: current.rfq.id,
        updatedFields: Object.keys(input),
        totalAmount: pricing.totalAmount,
      },
      ...context,
    });

    return quotation;
  });
};

const withdraw = async (supplierId: string, quotationId: string, context: AuditContext) => {
  return prisma.$transaction(async (tx) => {
    const current = await tx.quotation.findFirst({
      where: { id: quotationId, supplierId, deletedAt: null },
      select: {
        id: true,
        status: true,
        rfq: {
          select: { id: true, status: true, submissionDeadline: true },
        },
      },
    });

    if (!current) {
      throw new AppError(404, "Quotation not found");
    }
    if (current.status !== "SUBMITTED") {
      throw new AppError(409, "Only submitted quotations can be withdrawn");
    }
    assertOpenRfq(current.rfq);

    const quotation = await tx.quotation.update({
      where: { id: quotationId },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      select: quotationDetailSelect,
    });

    await AuditService.create(tx, {
      actorId: supplierId,
      action: "QUOTATION_WITHDRAWN",
      entityType: "Quotation",
      entityId: quotationId,
      metadata: { rfqId: current.rfq.id },
      ...context,
    });

    return quotation;
  });
};

export const QuotationService = {
  submit,
  listMine,
  getMineById,
  update,
  withdraw,
};
