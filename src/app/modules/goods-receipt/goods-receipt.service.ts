import { randomUUID } from "node:crypto";
import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { evaluateGoodsReceipt } from "./goods-receipt.domain.js";
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptListQuery,
} from "./goods-receipt.validation.js";

const goodsReceiptSelect = {
  id: true,
  receiptNumber: true,
  purchaseOrderId: true,
  buyerId: true,
  status: true,
  receivedAt: true,
  inspectedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  purchaseOrder: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      buyerId: true,
      supplierId: true,
      currency: true,
      supplier: {
        select: {
          supplierProfile: { select: { companyName: true } },
        },
      },
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
      purchaseOrderItemId: true,
      quantityReceived: true,
      quantityAccepted: true,
      quantityRejected: true,
      notes: true,
      purchaseOrderItem: {
        select: {
          itemName: true,
          quantity: true,
          unit: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const goodsReceiptListSelect = {
  id: true,
  receiptNumber: true,
  status: true,
  receivedAt: true,
  inspectedAt: true,
  notes: true,
  purchaseOrderId: true,
  _count: { select: { items: true } },
} as const;

type ProcurementRole = Extract<UserRole, "BUYER" | "SUPPLIER">;

const purchaseOrderScope = (
  userId: string,
  role: ProcurementRole,
): Prisma.PurchaseOrderWhereInput =>
  role === "BUYER" ? { buyerId: userId } : { supplierId: userId };

const generateReceiptNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `GR-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const create = async (
  buyerId: string,
  purchaseOrderId: string,
  input: CreateGoodsReceiptInput,
  context: AuditContext,
) => {
  return prisma.$transaction(
    async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.findFirst({
        where: { id: purchaseOrderId, buyerId },
        select: {
          id: true,
          poNumber: true,
          buyerId: true,
          supplierId: true,
          status: true,
          updatedAt: true,
          items: {
            select: { id: true, quantity: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!purchaseOrder) {
        throw new AppError(404, "Purchase order not found");
      }

      const acceptedRows = await tx.goodsReceiptItem.groupBy({
        by: ["purchaseOrderItemId"],
        where: {
          purchaseOrderItemId: {
            in: purchaseOrder.items.map((item) => item.id),
          },
        },
        _sum: { quantityAccepted: true },
      });
      const acceptedByItem = new Map(
        acceptedRows.map((row) => [
          row.purchaseOrderItemId,
          Number(row._sum.quantityAccepted ?? 0),
        ]),
      );

      const evaluation = evaluateGoodsReceipt(
        purchaseOrder.status,
        purchaseOrder.items.map((item) => ({
          id: item.id,
          orderedQuantity: Number(item.quantity),
          acceptedToDate: acceptedByItem.get(item.id) ?? 0,
        })),
        input.items,
      );

      const now = new Date();
      const receipt = await tx.goodsReceipt.create({
        data: {
          receiptNumber: generateReceiptNumber(),
          purchaseOrderId: purchaseOrder.id,
          buyerId,
          status: evaluation.receiptStatus,
          receivedAt: now,
          inspectedAt: now,
          notes: input.notes,
          items: {
            create: evaluation.items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantityReceived: item.quantityReceived,
              quantityAccepted: item.quantityAccepted,
              quantityRejected: item.quantityRejected,
              notes: item.notes,
            })),
          },
        },
        select: { id: true, receiptNumber: true },
      });

      const update = await tx.purchaseOrder.updateMany({
        where: {
          id: purchaseOrder.id,
          buyerId,
          status: purchaseOrder.status,
          updatedAt: purchaseOrder.updatedAt,
        },
        data: {
          status: evaluation.nextPurchaseOrderStatus,
          ...(evaluation.nextPurchaseOrderStatus === "DELIVERED"
            ? { deliveredAt: now }
            : {}),
        },
      });

      if (update.count !== 1) {
        throw new AppError(
          409,
          "Purchase order changed while goods were being received; retry the receipt",
        );
      }

      await AuditService.create(tx, {
        actorId: buyerId,
        action: "GOODS_RECEIPT_RECORDED",
        entityType: "GoodsReceipt",
        entityId: receipt.id,
        metadata: {
          purchaseOrderId: purchaseOrder.id,
          poNumber: purchaseOrder.poNumber,
          receiptNumber: receipt.receiptNumber,
          receiptStatus: evaluation.receiptStatus,
          purchaseOrderStatus: evaluation.nextPurchaseOrderStatus,
          itemCount: evaluation.items.length,
        },
        ...context,
      });

      await tx.notification.create({
        data: {
          userId: purchaseOrder.supplierId,
          type: "GOODS_RECEIPT_RECORDED",
          title: "Goods receipt recorded",
          message: `${receipt.receiptNumber} was recorded for ${purchaseOrder.poNumber}.`,
          metadata: {
            goodsReceiptId: receipt.id,
            purchaseOrderId: purchaseOrder.id,
            receiptNumber: receipt.receiptNumber,
            receiptStatus: evaluation.receiptStatus,
          },
        },
      });

      return tx.goodsReceipt.findUniqueOrThrow({
        where: { id: receipt.id },
        select: goodsReceiptSelect,
      });
    },
    { isolationLevel: "Serializable" },
  );
};

const listByPurchaseOrder = async (
  userId: string,
  role: ProcurementRole,
  purchaseOrderId: string,
  query: GoodsReceiptListQuery,
) => {
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, ...purchaseOrderScope(userId, role) },
    select: { id: true },
  });
  if (!purchaseOrder) {
    throw new AppError(404, "Purchase order not found");
  }

  const where: Prisma.GoodsReceiptWhereInput = { purchaseOrderId };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where,
      select: goodsReceiptListSelect,
      orderBy: { receivedAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.goodsReceipt.count({ where }),
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

const getById = async (
  userId: string,
  role: ProcurementRole,
  goodsReceiptId: string,
) => {
  const receipt = await prisma.goodsReceipt.findFirst({
    where: {
      id: goodsReceiptId,
      purchaseOrder: purchaseOrderScope(userId, role),
    },
    select: goodsReceiptSelect,
  });

  if (!receipt) {
    throw new AppError(404, "Goods receipt not found");
  }
  return receipt;
};

export const GoodsReceiptService = {
  create,
  listByPurchaseOrder,
  getById,
};
