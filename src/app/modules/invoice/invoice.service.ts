import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import {
  assertInvoiceApprovalAllowed,
  assertInvoiceCancellationAllowed,
  assertInvoiceRejectionAllowed,
  assertInvoiceReviewStartAllowed,
  calculateInvoice,
} from "./invoice.domain.js";
import type {
  CreateInvoiceInput,
  InvoiceListQuery,
} from "./invoice.validation.js";

const invoiceListSelect = {
  id: true,
  invoiceNumber: true,
  purchaseOrderId: true,
  supplierId: true,
  buyerId: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  dueDate: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  approvedAt: true,
  rejectedAt: true,
  paidAt: true,
  updatedAt: true,
  purchaseOrder: {
    select: {
      id: true,
      poNumber: true,
      status: true,
    },
  },
  buyer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      buyerProfile: { select: { companyName: true } },
    },
  },
  supplier: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      supplierProfile: { select: { companyName: true } },
    },
  },
  _count: { select: { items: true, payments: true } },
} as const;

const invoiceDetailSelect = {
  ...invoiceListSelect,
  notes: true,
  rejectionReason: true,
  items: {
    select: {
      id: true,
      purchaseOrderItemId: true,
      description: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      purchaseOrderItem: {
        select: {
          itemName: true,
          unit: true,
          quantity: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type ProcurementRole = Extract<UserRole, "BUYER" | "SUPPLIER">;

const invoiceScope = (
  userId: string,
  role: ProcurementRole,
): Prisma.InvoiceWhereInput =>
  role === "BUYER" ? { buyerId: userId } : { supplierId: userId };

const purchaseOrderScope = (
  userId: string,
  role: ProcurementRole,
): Prisma.PurchaseOrderWhereInput =>
  role === "BUYER" ? { buyerId: userId } : { supplierId: userId };

const parseDueDate = (value: string) => {
  const dueDate = new Date(`${value}T00:00:00.000Z`);
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (dueDate < todayUtc) {
    throw new AppError(400, "Invoice due date cannot be in the past");
  }
  return dueDate;
};

const create = async (
  supplierId: string,
  purchaseOrderId: string,
  input: CreateInvoiceInput,
  context: AuditContext,
) => {
  return prisma.$transaction(
    async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, supplierId },
        select: {
          id: true,
          poNumber: true,
          buyerId: true,
          supplierId: true,
          currency: true,
          status: true,
          updatedAt: true,
          items: {
            select: {
              id: true,
              itemName: true,
              quantity: true,
              unitPrice: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!purchaseOrder) {
        throw new AppError(404, "Purchase order not found");
      }

      const duplicateInvoice = await tx.invoice.findFirst({
        where: { supplierId, invoiceNumber: input.invoiceNumber },
        select: { id: true },
      });
      if (duplicateInvoice) {
        throw new AppError(
          409,
          "This invoice number has already been used by the supplier",
        );
      }

      const poItemIds = purchaseOrder.items.map((item) => item.id);
      const [acceptedRows, priorInvoiceRows] = await Promise.all([
        tx.goodsReceiptItem.groupBy({
          by: ["purchaseOrderItemId"],
          where: { purchaseOrderItemId: { in: poItemIds } },
          _sum: { quantityAccepted: true },
        }),
        tx.invoiceItem.findMany({
          where: {
            purchaseOrderItemId: { in: poItemIds },
            invoice: {
              purchaseOrderId: purchaseOrder.id,
              status: { notIn: ["REJECTED", "CANCELLED"] },
            },
          },
          select: { purchaseOrderItemId: true, quantity: true },
        }),
      ]);

      const acceptedByItem = new Map(
        acceptedRows.map((row) => [
          row.purchaseOrderItemId,
          Number(row._sum.quantityAccepted ?? 0),
        ]),
      );
      const invoicedByItem = new Map<string, number>();
      for (const row of priorInvoiceRows) {
        invoicedByItem.set(
          row.purchaseOrderItemId,
          (invoicedByItem.get(row.purchaseOrderItemId) ?? 0) +
            Number(row.quantity),
        );
      }

      const calculation = calculateInvoice(
        purchaseOrder.status,
        purchaseOrder.items.map((item) => ({
          id: item.id,
          unitPrice: Number(item.unitPrice),
          acceptedQuantity: acceptedByItem.get(item.id) ?? 0,
          invoicedQuantity: invoicedByItem.get(item.id) ?? 0,
        })),
        input.items,
        input.taxAmount,
      );

      const dueDate = parseDueDate(input.dueDate);
      const now = new Date();
      const lock = await tx.purchaseOrder.updateMany({
        where: {
          id: purchaseOrder.id,
          supplierId,
          status: purchaseOrder.status,
          updatedAt: purchaseOrder.updatedAt,
        },
        data: { updatedAt: now },
      });
      if (lock.count !== 1) {
        throw new AppError(
          409,
          "Purchase order changed while the invoice was being prepared; retry",
        );
      }

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: input.invoiceNumber,
          purchaseOrderId: purchaseOrder.id,
          supplierId,
          buyerId: purchaseOrder.buyerId,
          currency: purchaseOrder.currency,
          subtotal: calculation.subtotal,
          taxAmount: calculation.taxAmount,
          totalAmount: calculation.totalAmount,
          dueDate,
          notes: input.notes,
          status: "SUBMITTED",
          submittedAt: now,
          items: {
            create: calculation.items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true },
      });

      await AuditService.create(tx, {
        actorId: supplierId,
        action: "INVOICE_SUBMITTED",
        entityType: "Invoice",
        entityId: invoice.id,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
          currency: purchaseOrder.currency,
          totalAmount: Number(invoice.totalAmount),
          itemCount: calculation.items.length,
        },
        ...context,
      });

      await tx.notification.create({
        data: {
          userId: purchaseOrder.buyerId,
          type: "INVOICE_SUBMITTED",
          title: "New invoice submitted",
          message: `${invoice.invoiceNumber} was submitted for ${purchaseOrder.poNumber}.`,
          metadata: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            purchaseOrderId: purchaseOrder.id,
            totalAmount: Number(invoice.totalAmount),
            currency: purchaseOrder.currency,
          },
        },
      });

      return tx.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
        select: invoiceDetailSelect,
      });
    },
    { isolationLevel: "Serializable" },
  );
};

const buildInvoiceWhere = (
  userId: string,
  role: ProcurementRole,
  query: InvoiceListQuery,
  purchaseOrderId?: string,
): Prisma.InvoiceWhereInput => {
  const searchFilters: Prisma.InvoiceWhereInput[] = [];
  if (query.search) {
    searchFilters.push(
      { invoiceNumber: { contains: query.search, mode: "insensitive" } },
      {
        purchaseOrder: {
          poNumber: { contains: query.search, mode: "insensitive" },
        },
      },
    );
  }

  return {
    ...invoiceScope(userId, role),
    ...(purchaseOrderId ? { purchaseOrderId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
  };
};

const paginate = async (
  where: Prisma.InvoiceWhereInput,
  query: InvoiceListQuery,
) => {
  const skip = (query.page - 1) * query.limit;
  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.InvoiceOrderByWithRelationInput;
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: invoiceListSelect,
      orderBy,
      skip,
      take: query.limit,
    }),
    prisma.invoice.count({ where }),
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

const listMine = async (
  userId: string,
  role: ProcurementRole,
  query: InvoiceListQuery,
) => paginate(buildInvoiceWhere(userId, role, query), query);

const listByPurchaseOrder = async (
  userId: string,
  role: ProcurementRole,
  purchaseOrderId: string,
  query: InvoiceListQuery,
) => {
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, ...purchaseOrderScope(userId, role) },
    select: { id: true },
  });
  if (!purchaseOrder) {
    throw new AppError(404, "Purchase order not found");
  }
  return paginate(
    buildInvoiceWhere(userId, role, query, purchaseOrderId),
    query,
  );
};

const getById = async (
  userId: string,
  role: ProcurementRole,
  invoiceId: string,
) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...invoiceScope(userId, role) },
    select: invoiceDetailSelect,
  });
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }
  return invoice;
};

const startReview = async (
  buyerId: string,
  invoiceId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, buyerId },
      select: {
        id: true,
        invoiceNumber: true,
        supplierId: true,
        purchaseOrderId: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }

    assertInvoiceReviewStartAllowed(invoice.status);

    const now = new Date();
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, buyerId, status: "SUBMITTED" },
      data: {
        status: "UNDER_REVIEW",
        reviewedAt: now,
        rejectionReason: null,
        rejectedAt: null,
        approvedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError(409, "Invoice status changed; refresh and try again");
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "INVOICE_REVIEW_STARTED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrderId: invoice.purchaseOrderId,
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: invoice.supplierId,
        type: "INVOICE_UNDER_REVIEW",
        title: "Invoice under review",
        message: `${invoice.invoiceNumber} is now under buyer review.`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: invoice.purchaseOrderId,
        },
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: invoiceDetailSelect,
    });
  });
};

const approve = async (
  buyerId: string,
  invoiceId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, buyerId },
      select: {
        id: true,
        invoiceNumber: true,
        supplierId: true,
        purchaseOrderId: true,
        currency: true,
        totalAmount: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }

    assertInvoiceApprovalAllowed(invoice.status);

    const now = new Date();
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, buyerId, status: "UNDER_REVIEW" },
      data: {
        status: "APPROVED",
        approvedAt: now,
        rejectionReason: null,
        rejectedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError(409, "Invoice status changed; refresh and try again");
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "INVOICE_APPROVED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrderId: invoice.purchaseOrderId,
        currency: invoice.currency,
        totalAmount: Number(invoice.totalAmount),
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: invoice.supplierId,
        type: "INVOICE_APPROVED",
        title: "Invoice approved",
        message: `${invoice.invoiceNumber} was approved and is ready for payment.`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: invoice.purchaseOrderId,
          totalAmount: Number(invoice.totalAmount),
          currency: invoice.currency,
        },
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: invoiceDetailSelect,
    });
  });
};

const reject = async (
  buyerId: string,
  invoiceId: string,
  reason: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, buyerId },
      select: {
        id: true,
        invoiceNumber: true,
        supplierId: true,
        purchaseOrderId: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }

    assertInvoiceRejectionAllowed(invoice.status);

    const now = new Date();
    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, buyerId, status: "UNDER_REVIEW" },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        rejectedAt: now,
        approvedAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError(409, "Invoice status changed; refresh and try again");
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "INVOICE_REJECTED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrderId: invoice.purchaseOrderId,
        reason,
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: invoice.supplierId,
        type: "INVOICE_REJECTED",
        title: "Invoice rejected",
        message: `${invoice.invoiceNumber} was rejected by the buyer.`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: invoice.purchaseOrderId,
          reason,
        },
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: invoiceDetailSelect,
    });
  });
};

const cancel = async (
  supplierId: string,
  invoiceId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, supplierId },
      select: {
        id: true,
        invoiceNumber: true,
        buyerId: true,
        purchaseOrderId: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }

    assertInvoiceCancellationAllowed(invoice.status);

    const updated = await tx.invoice.updateMany({
      where: { id: invoice.id, supplierId, status: "SUBMITTED" },
      data: { status: "CANCELLED" },
    });
    if (updated.count !== 1) {
      throw new AppError(409, "Invoice status changed; refresh and try again");
    }

    await AuditService.create(tx, {
      actorId: supplierId,
      action: "INVOICE_CANCELLED",
      entityType: "Invoice",
      entityId: invoice.id,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        purchaseOrderId: invoice.purchaseOrderId,
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: invoice.buyerId,
        type: "INVOICE_CANCELLED",
        title: "Invoice cancelled",
        message: `${invoice.invoiceNumber} was cancelled by the supplier.`,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          purchaseOrderId: invoice.purchaseOrderId,
        },
      },
    });

    return tx.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: invoiceDetailSelect,
    });
  });
};

export const InvoiceService = {
  create,
  listMine,
  listByPurchaseOrder,
  getById,
  startReview,
  approve,
  reject,
  cancel,
};
