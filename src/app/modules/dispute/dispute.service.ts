import type { Prisma, UserRole } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import {
  ACTIVE_DISPUTE_STATUSES,
  assertDisputeCanBeFinalized,
  assertDisputeCanEnterReview,
  assertInvoiceCanBeDisputed,
  assertPurchaseOrderCanBeDisputed,
} from "./dispute.domain.js";
import type {
  DisputeListQuery,
  OpenDisputeInput,
} from "./dispute.validation.js";

const disputeSelect = {
  id: true,
  purchaseOrderId: true,
  invoiceId: true,
  openedById: true,
  againstUserId: true,
  resolvedById: true,
  subject: true,
  description: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  purchaseOrder: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
    },
  },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      currency: true,
    },
  },
  openedBy: {
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      buyerProfile: { select: { companyName: true } },
      supplierProfile: { select: { companyName: true } },
    },
  },
  againstUser: {
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      buyerProfile: { select: { companyName: true } },
      supplierProfile: { select: { companyName: true } },
    },
  },
  resolvedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

type ParticipantRole = Extract<UserRole, "BUYER" | "SUPPLIER">;

const assertParticipantRole = (role: UserRole): ParticipantRole => {
  if (role !== "BUYER" && role !== "SUPPLIER") {
    throw new AppError(403, "Only buyers and suppliers can open disputes");
  }
  return role;
};

const createDispute = async (
  actorId: string,
  againstUserId: string,
  target: { purchaseOrderId?: string; invoiceId?: string },
  targetLabel: string,
  input: OpenDisputeInput,
  context: AuditContext,
) => {
  return prisma.$transaction(
    async (tx) => {
      const active = await tx.dispute.findFirst({
        where: {
          status: { in: ACTIVE_DISPUTE_STATUSES },
          ...(target.purchaseOrderId
            ? { purchaseOrderId: target.purchaseOrderId }
            : {}),
          ...(target.invoiceId ? { invoiceId: target.invoiceId } : {}),
        },
        select: { id: true },
      });
      if (active) {
        throw new AppError(
          409,
          "An active dispute already exists for this transaction",
        );
      }

      const targetMetadata = target.purchaseOrderId
        ? { purchaseOrderId: target.purchaseOrderId }
        : { invoiceId: target.invoiceId as string };

      const dispute = await tx.dispute.create({
        data: {
          ...target,
          openedById: actorId,
          againstUserId,
          subject: input.subject,
          description: input.description,
        },
        select: disputeSelect,
      });

      await AuditService.create(tx, {
        actorId,
        action: "DISPUTE_OPENED",
        entityType: "Dispute",
        entityId: dispute.id,
        metadata: { ...targetMetadata, againstUserId },
        ...context,
      });

      const admins = await tx.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      const notifications: Prisma.NotificationCreateManyInput[] = [
        {
          userId: againstUserId,
          type: "DISPUTE_OPENED",
          title: "New transaction dispute",
          message: `A dispute was opened for ${targetLabel}.`,
          metadata: { disputeId: dispute.id, ...targetMetadata },
        },
        ...admins.map((admin) => ({
          userId: admin.id,
          type: "DISPUTE_OPENED",
          title: "Dispute requires review",
          message: `A dispute was opened for ${targetLabel}.`,
          metadata: { disputeId: dispute.id, ...targetMetadata },
        })),
      ];
      await tx.notification.createMany({ data: notifications });

      return dispute;
    },
    { isolationLevel: "Serializable" },
  );
};

const openForPurchaseOrder = async (
  actorId: string,
  role: UserRole,
  purchaseOrderId: string,
  input: OpenDisputeInput,
  context: AuditContext,
) => {
  const participantRole = assertParticipantRole(role);
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      id: true,
      poNumber: true,
      buyerId: true,
      supplierId: true,
      status: true,
    },
  });
  if (!purchaseOrder) throw new AppError(404, "Purchase order not found");

  const expectedActorId =
    participantRole === "BUYER"
      ? purchaseOrder.buyerId
      : purchaseOrder.supplierId;
  if (expectedActorId !== actorId) {
    throw new AppError(404, "Purchase order not found");
  }
  assertPurchaseOrderCanBeDisputed(purchaseOrder.status);

  const againstUserId =
    participantRole === "BUYER"
      ? purchaseOrder.supplierId
      : purchaseOrder.buyerId;
  return createDispute(
    actorId,
    againstUserId,
    { purchaseOrderId: purchaseOrder.id },
    purchaseOrder.poNumber,
    input,
    context,
  );
};

const openForInvoice = async (
  actorId: string,
  role: UserRole,
  invoiceId: string,
  input: OpenDisputeInput,
  context: AuditContext,
) => {
  const participantRole = assertParticipantRole(role);
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      buyerId: true,
      supplierId: true,
      status: true,
    },
  });
  if (!invoice) throw new AppError(404, "Invoice not found");

  const expectedActorId =
    participantRole === "BUYER" ? invoice.buyerId : invoice.supplierId;
  if (expectedActorId !== actorId) {
    throw new AppError(404, "Invoice not found");
  }
  assertInvoiceCanBeDisputed(invoice.status);

  const againstUserId =
    participantRole === "BUYER" ? invoice.supplierId : invoice.buyerId;
  return createDispute(
    actorId,
    againstUserId,
    { invoiceId: invoice.id },
    invoice.invoiceNumber,
    input,
    context,
  );
};

const listMine = async (userId: string, query: DisputeListQuery) => {
  const targetFilter: Prisma.DisputeWhereInput =
    query.targetType === "PURCHASE_ORDER"
      ? { purchaseOrderId: { not: null } }
      : query.targetType === "INVOICE"
        ? { invoiceId: { not: null } }
        : {};

  const where: Prisma.DisputeWhereInput = {
    OR: [{ openedById: userId }, { againstUserId: userId }],
    ...targetFilter,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          AND: [
            {
              OR: [
                { subject: { contains: query.search, mode: "insensitive" } },
                {
                  description: { contains: query.search, mode: "insensitive" },
                },
                {
                  purchaseOrder: {
                    poNumber: { contains: query.search, mode: "insensitive" },
                  },
                },
                {
                  invoice: {
                    invoiceNumber: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      select: disputeSelect,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.limit,
    }),
    prisma.dispute.count({ where }),
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

const getMineById = async (userId: string, disputeId: string) => {
  const dispute = await prisma.dispute.findFirst({
    where: {
      id: disputeId,
      OR: [{ openedById: userId }, { againstUserId: userId }],
    },
    select: disputeSelect,
  });
  if (!dispute) throw new AppError(404, "Dispute not found");
  return dispute;
};

const listAdmin = async (query: DisputeListQuery) => {
  const targetFilter: Prisma.DisputeWhereInput =
    query.targetType === "PURCHASE_ORDER"
      ? { purchaseOrderId: { not: null } }
      : query.targetType === "INVOICE"
        ? { invoiceId: { not: null } }
        : {};

  const where: Prisma.DisputeWhereInput = {
    ...targetFilter,
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
            {
              purchaseOrder: {
                poNumber: { contains: query.search, mode: "insensitive" },
              },
            },
            {
              invoice: {
                invoiceNumber: { contains: query.search, mode: "insensitive" },
              },
            },
            {
              openedBy: {
                email: { contains: query.search, mode: "insensitive" },
              },
            },
            {
              againstUser: {
                email: { contains: query.search, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      select: disputeSelect,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.limit,
    }),
    prisma.dispute.count({ where }),
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

const getAdminById = async (disputeId: string) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: disputeSelect,
  });
  if (!dispute) throw new AppError(404, "Dispute not found");
  return dispute;
};

const startReview = async (
  adminId: string,
  disputeId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, status: true, openedById: true, againstUserId: true },
    });
    if (!dispute) throw new AppError(404, "Dispute not found");
    assertDisputeCanEnterReview(dispute.status);

    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: { status: "UNDER_REVIEW" },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "Dispute state changed; refresh and try again");
    }

    await AuditService.create(tx, {
      actorId: adminId,
      action: "DISPUTE_REVIEW_STARTED",
      entityType: "Dispute",
      entityId: disputeId,
      ...context,
    });

    await tx.notification.createMany({
      data: [dispute.openedById, dispute.againstUserId].map((userId) => ({
        userId,
        type: "DISPUTE_UNDER_REVIEW",
        title: "Dispute under review",
        message: "An administrator has started reviewing the dispute.",
        metadata: { disputeId },
      })),
    });

    return tx.dispute.findUniqueOrThrow({
      where: { id: disputeId },
      select: disputeSelect,
    });
  });
};

const finalize = async (
  adminId: string,
  disputeId: string,
  targetStatus: "RESOLVED" | "REJECTED",
  resolution: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true, status: true, openedById: true, againstUserId: true },
    });
    if (!dispute) throw new AppError(404, "Dispute not found");
    assertDisputeCanBeFinalized(dispute.status);

    const timestamp = new Date();
    const claimed = await tx.dispute.updateMany({
      where: { id: disputeId, status: "UNDER_REVIEW" },
      data: {
        status: targetStatus,
        resolution,
        resolvedById: adminId,
        resolvedAt: timestamp,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(409, "Dispute state changed; refresh and try again");
    }

    const action =
      targetStatus === "RESOLVED" ? "DISPUTE_RESOLVED" : "DISPUTE_REJECTED";
    await AuditService.create(tx, {
      actorId: adminId,
      action,
      entityType: "Dispute",
      entityId: disputeId,
      metadata: { resolution },
      ...context,
    });

    await tx.notification.createMany({
      data: [dispute.openedById, dispute.againstUserId].map((userId) => ({
        userId,
        type: action,
        title:
          targetStatus === "RESOLVED" ? "Dispute resolved" : "Dispute rejected",
        message: resolution,
        metadata: { disputeId },
      })),
    });

    return tx.dispute.findUniqueOrThrow({
      where: { id: disputeId },
      select: disputeSelect,
    });
  });
};

const resolve = (
  adminId: string,
  disputeId: string,
  resolution: string,
  context: AuditContext,
) => finalize(adminId, disputeId, "RESOLVED", resolution, context);

const reject = (
  adminId: string,
  disputeId: string,
  resolution: string,
  context: AuditContext,
) => finalize(adminId, disputeId, "REJECTED", resolution, context);

export const DisputeService = {
  openForPurchaseOrder,
  openForInvoice,
  listMine,
  getMineById,
  listAdmin,
  getAdminById,
  startReview,
  resolve,
  reject,
};
