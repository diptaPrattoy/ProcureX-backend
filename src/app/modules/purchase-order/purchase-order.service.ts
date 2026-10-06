import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { assertPurchaseOrderTransition } from "./purchase-order.domain.js";
import type { PurchaseOrderListQuery } from "./purchase-order.validation.js";

const purchaseOrderListSelect = {
  id: true,
  poNumber: true,
  rfqId: true,
  quotationId: true,
  currency: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  status: true,
  issuedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  deliveredAt: true,
  completedAt: true,
  cancelledAt: true,
  updatedAt: true,
  rfq: {
    select: {
      id: true,
      title: true,
      expectedDeliveryDate: true,
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
      supplierProfile: {
        select: {
          id: true,
          companyName: true,
          verificationStatus: true,
        },
      },
    },
  },
  _count: {
    select: {
      items: true,
      goodsReceipts: true,
      invoices: true,
    },
  },
} as const;

const purchaseOrderDetailSelect = {
  ...purchaseOrderListSelect,
  shippingAddress: true,
  notes: true,
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

type SupportedPurchaseOrderRole = Extract<UserRole, "BUYER" | "SUPPLIER">;

const roleScope = (
  userId: string,
  role: SupportedPurchaseOrderRole,
): Prisma.PurchaseOrderWhereInput =>
  role === "BUYER" ? { buyerId: userId } : { supplierId: userId };

const listMine = async (
  userId: string,
  role: SupportedPurchaseOrderRole,
  query: PurchaseOrderListQuery,
) => {
  const scope = roleScope(userId, role);
  const searchFilters: Prisma.PurchaseOrderWhereInput[] = [];
  if (query.search) {
    searchFilters.push(
      { poNumber: { contains: query.search, mode: "insensitive" } },
      { rfq: { title: { contains: query.search, mode: "insensitive" } } },
    );
    if (role === "BUYER") {
      searchFilters.push({
        supplier: {
          supplierProfile: {
            companyName: { contains: query.search, mode: "insensitive" },
          },
        },
      });
    } else {
      searchFilters.push({
        buyer: {
          buyerProfile: {
            companyName: { contains: query.search, mode: "insensitive" },
          },
        },
      });
    }
  }

  const where: Prisma.PurchaseOrderWhereInput = {
    ...scope,
    ...(query.status ? { status: query.status } : {}),
    ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } as Prisma.PurchaseOrderOrderByWithRelationInput;
  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      select: purchaseOrderListSelect,
      orderBy,
      skip,
      take: query.limit,
    }),
    prisma.purchaseOrder.count({ where }),
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

const getMineById = async (
  userId: string,
  role: SupportedPurchaseOrderRole,
  purchaseOrderId: string,
) => {
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, ...roleScope(userId, role) },
    select: purchaseOrderDetailSelect,
  });

  if (!purchaseOrder) {
    throw new AppError(404, "Purchase order not found");
  }
  return purchaseOrder;
};

const transitionSupplierOrder = async (
  supplierId: string,
  purchaseOrderId: string,
  action: "ACCEPT" | "REJECT" | "START_FULFILLMENT",
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, supplierId },
      select: {
        id: true,
        poNumber: true,
        buyerId: true,
        supplierId: true,
        status: true,
      },
    });
    if (!purchaseOrder) {
      throw new AppError(404, "Purchase order not found");
    }

    const targetStatus = assertPurchaseOrderTransition({
      status: purchaseOrder.status,
      actor: "SUPPLIER",
      action,
    });
    const timestamp = new Date();

    const updateData: Prisma.PurchaseOrderUpdateManyMutationInput = {
      status: targetStatus,
      ...(action === "ACCEPT" ? { acceptedAt: timestamp } : {}),
      ...(action === "REJECT" ? { rejectedAt: timestamp } : {}),
    };

    const transition = await tx.purchaseOrder.updateMany({
      where: {
        id: purchaseOrder.id,
        supplierId,
        status: purchaseOrder.status,
      },
      data: updateData,
    });
    if (transition.count !== 1) {
      throw new AppError(
        409,
        "Purchase order status changed; refresh and try again",
      );
    }

    const auditAction =
      action === "ACCEPT"
        ? "PURCHASE_ORDER_ACCEPTED"
        : action === "REJECT"
          ? "PURCHASE_ORDER_REJECTED"
          : "PURCHASE_ORDER_FULFILLMENT_STARTED";

    await AuditService.create(tx, {
      actorId: supplierId,
      action: auditAction,
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      metadata: {
        poNumber: purchaseOrder.poNumber,
        previousStatus: purchaseOrder.status,
        targetStatus,
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: purchaseOrder.buyerId,
        type: auditAction,
        title:
          action === "ACCEPT"
            ? "Purchase order accepted"
            : action === "REJECT"
              ? "Purchase order rejected"
              : "Purchase order fulfillment started",
        message:
          action === "ACCEPT"
            ? `${purchaseOrder.poNumber} was accepted by the supplier.`
            : action === "REJECT"
              ? `${purchaseOrder.poNumber} was rejected by the supplier.`
              : `Fulfillment has started for ${purchaseOrder.poNumber}.`,
        metadata: {
          purchaseOrderId: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
        },
      },
    });

    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder.id },
      select: purchaseOrderDetailSelect,
    });
  });
};

const cancelByBuyer = async (
  buyerId: string,
  purchaseOrderId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, buyerId },
      select: {
        id: true,
        poNumber: true,
        buyerId: true,
        supplierId: true,
        status: true,
      },
    });
    if (!purchaseOrder) {
      throw new AppError(404, "Purchase order not found");
    }

    const targetStatus = assertPurchaseOrderTransition({
      status: purchaseOrder.status,
      actor: "BUYER",
      action: "CANCEL",
    });
    const cancelledAt = new Date();

    const transition = await tx.purchaseOrder.updateMany({
      where: { id: purchaseOrder.id, buyerId, status: "ISSUED" },
      data: { status: "CANCELLED", cancelledAt },
    });
    if (transition.count !== 1) {
      throw new AppError(
        409,
        "Purchase order status changed; refresh and try again",
      );
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "PURCHASE_ORDER_CANCELLED",
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      metadata: {
        poNumber: purchaseOrder.poNumber,
        previousStatus: purchaseOrder.status,
        targetStatus,
      },
      ...context,
    });

    await tx.notification.create({
      data: {
        userId: purchaseOrder.supplierId,
        type: "PURCHASE_ORDER_CANCELLED",
        title: "Purchase order cancelled",
        message: `${purchaseOrder.poNumber} was cancelled by the buyer before acceptance.`,
        metadata: {
          purchaseOrderId: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
        },
      },
    });

    return tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder.id },
      select: purchaseOrderDetailSelect,
    });
  });
};

const accept = (
  supplierId: string,
  purchaseOrderId: string,
  context: AuditContext,
) => transitionSupplierOrder(supplierId, purchaseOrderId, "ACCEPT", context);

const reject = (
  supplierId: string,
  purchaseOrderId: string,
  context: AuditContext,
) => transitionSupplierOrder(supplierId, purchaseOrderId, "REJECT", context);

const startFulfillment = (
  supplierId: string,
  purchaseOrderId: string,
  context: AuditContext,
) =>
  transitionSupplierOrder(
    supplierId,
    purchaseOrderId,
    "START_FULFILLMENT",
    context,
  );

export const PurchaseOrderService = {
  listMine,
  getMineById,
  accept,
  reject,
  startFulfillment,
  cancelByBuyer,
};
