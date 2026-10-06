import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { toStripeMinorUnits } from "../payment/payment.domain.js";
import { getStripeClient } from "../payment/stripe.client.js";
import {
  ACTIVE_REFUND_STATUSES,
  assertPaymentCanBeRefunded,
  assertRefundCanBeCancelled,
  assertRefundCanBeReviewed,
  canApplyProviderRefundStatus,
  fromStripeMinorUnits,
  mapStripeRefundStatus,
} from "./refund.domain.js";
import { reconcilePaymentRefundStatus } from "./refund.reconciliation.js";
import type {
  RefundListQuery,
  RequestRefundInput,
} from "./refund.validation.js";

const refundSelect = {
  id: true,
  paymentId: true,
  invoiceId: true,
  requestedById: true,
  reviewedById: true,
  status: true,
  currency: true,
  amount: true,
  reason: true,
  adminNote: true,
  providerRefundId: true,
  providerStatus: true,
  failureReason: true,
  requestedAt: true,
  reviewedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  invoice: {
    select: {
      invoiceNumber: true,
      supplierId: true,
      buyerId: true,
      totalAmount: true,
      purchaseOrder: { select: { poNumber: true } },
    },
  },
  payment: {
    select: {
      status: true,
      amount: true,
      currency: true,
      providerPaymentIntentId: true,
    },
  },
  requestedBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      buyerProfile: { select: { companyName: true } },
    },
  },
  reviewedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
} as const;

const requestRefund = async (
  buyerId: string,
  paymentId: string,
  input: RequestRefundInput,
  context: AuditContext,
) => {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, buyerId },
        select: {
          id: true,
          invoiceId: true,
          buyerId: true,
          status: true,
          currency: true,
          amount: true,
          providerPaymentIntentId: true,
          invoice: {
            select: {
              invoiceNumber: true,
              supplierId: true,
              status: true,
            },
          },
        },
      });

      if (!payment) {
        throw new AppError(404, "Payment not found");
      }
      assertPaymentCanBeRefunded(payment.status);
      if (!payment.providerPaymentIntentId) {
        throw new AppError(
          409,
          "Payment provider reference is not available for refunds",
        );
      }

      const reserved = await tx.refund.aggregate({
        where: {
          paymentId: payment.id,
          status: { in: ACTIVE_REFUND_STATUSES },
        },
        _sum: { amount: true },
      });

      const paidMinor = toStripeMinorUnits(
        payment.amount.toString(),
        payment.currency,
      );
      const reservedMinor = reserved._sum.amount
        ? toStripeMinorUnits(reserved._sum.amount.toString(), payment.currency)
        : 0;
      const remainingMinor = paidMinor - reservedMinor;
      if (remainingMinor <= 0) {
        throw new AppError(409, "No refundable payment balance remains");
      }

      const requestedMinor =
        input.amount === undefined
          ? remainingMinor
          : toStripeMinorUnits(String(input.amount), payment.currency);
      if (requestedMinor > remainingMinor) {
        throw new AppError(
          409,
          "Refund amount exceeds the remaining refundable balance",
        );
      }

      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          requestedById: buyerId,
          currency: payment.currency,
          amount: fromStripeMinorUnits(requestedMinor, payment.currency),
          reason: input.reason,
          idempotencyKey: `stripe-refund:${payment.id}:${randomUUID()}`,
        },
        select: refundSelect,
      });

      await AuditService.create(tx, {
        actorId: buyerId,
        action: "REFUND_REQUESTED",
        entityType: "Refund",
        entityId: refund.id,
        metadata: {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          invoiceNumber: payment.invoice.invoiceNumber,
          amount: Number(refund.amount),
          currency: payment.currency,
        },
        ...context,
      });

      const admins = await tx.user.findMany({
        where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      const notificationData: Prisma.NotificationCreateManyInput[] = admins.map(
        (admin) => ({
          userId: admin.id,
          type: "REFUND_REQUESTED",
          title: "Refund review required",
          message: `A refund was requested for ${payment.invoice.invoiceNumber}.`,
          metadata: {
            refundId: refund.id,
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
          },
        }),
      );
      notificationData.push({
        userId: payment.invoice.supplierId,
        type: "REFUND_REQUESTED",
        title: "Refund requested",
        message: `A refund was requested for ${payment.invoice.invoiceNumber}.`,
        metadata: {
          refundId: refund.id,
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
        },
      });
      if (notificationData.length > 0) {
        await tx.notification.createMany({ data: notificationData });
      }

      return refund;
    },
    { isolationLevel: "Serializable" },
  );
};

const listMine = async (buyerId: string, query: RefundListQuery) => {
  const where: Prisma.RefundWhereInput = {
    requestedById: buyerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      select: refundSelect,
      orderBy: { requestedAt: query.sortOrder },
      skip,
      take: query.limit,
    }),
    prisma.refund.count({ where }),
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

const getMineById = async (buyerId: string, refundId: string) => {
  const refund = await prisma.refund.findFirst({
    where: { id: refundId, requestedById: buyerId },
    select: refundSelect,
  });
  if (!refund) {
    throw new AppError(404, "Refund request not found");
  }
  return refund;
};

const cancelMine = async (
  buyerId: string,
  refundId: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findFirst({
      where: { id: refundId, requestedById: buyerId },
      select: { id: true, status: true, invoiceId: true, paymentId: true },
    });
    if (!refund) {
      throw new AppError(404, "Refund request not found");
    }
    assertRefundCanBeCancelled(refund.status);

    const claimed = await tx.refund.updateMany({
      where: { id: refundId, requestedById: buyerId, status: "REQUESTED" },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        409,
        "Refund request state changed; retry the request",
      );
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "REFUND_CANCELLED",
      entityType: "Refund",
      entityId: refundId,
      metadata: { paymentId: refund.paymentId, invoiceId: refund.invoiceId },
      ...context,
    });

    return tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: refundSelect,
    });
  });
};

const listAdmin = async (query: RefundListQuery) => {
  const where: Prisma.RefundWhereInput = query.status
    ? { status: query.status }
    : {};
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      select: refundSelect,
      orderBy: { requestedAt: query.sortOrder },
      skip,
      take: query.limit,
    }),
    prisma.refund.count({ where }),
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

const getAdminById = async (refundId: string) => {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    select: refundSelect,
  });
  if (!refund) {
    throw new AppError(404, "Refund request not found");
  }
  return refund;
};

const reject = async (
  adminId: string,
  refundId: string,
  note: string,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        paymentId: true,
        invoiceId: true,
      },
    });
    if (!refund) {
      throw new AppError(404, "Refund request not found");
    }
    assertRefundCanBeReviewed(refund.status);

    const now = new Date();
    const claimed = await tx.refund.updateMany({
      where: { id: refundId, status: "REQUESTED" },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: now,
        completedAt: now,
        adminNote: note,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        409,
        "Refund request state changed; retry the request",
      );
    }

    await AuditService.create(tx, {
      actorId: adminId,
      action: "REFUND_REJECTED",
      entityType: "Refund",
      entityId: refundId,
      metadata: {
        paymentId: refund.paymentId,
        invoiceId: refund.invoiceId,
        note,
      },
      ...context,
    });
    await tx.notification.create({
      data: {
        userId: refund.requestedById,
        type: "REFUND_REJECTED",
        title: "Refund request rejected",
        message: "Your refund request was reviewed and rejected.",
        metadata: {
          refundId,
          paymentId: refund.paymentId,
          invoiceId: refund.invoiceId,
        },
      },
    });

    return tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: refundSelect,
    });
  });
};

type PreparedProviderRefund = {
  id: string;
  paymentId: string;
  invoiceId: string;
  requestedById: string;
  amount: Prisma.Decimal;
  currency: string;
  idempotencyKey: string;
  payment: { providerPaymentIntentId: string | null; status: string };
};

const prepareProviderRefund = async (
  adminId: string,
  refundId: string,
  note: string | undefined,
  retry: boolean,
  context: AuditContext,
): Promise<PreparedProviderRefund> => {
  return prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        paymentId: true,
        invoiceId: true,
        requestedById: true,
        amount: true,
        currency: true,
        status: true,
        idempotencyKey: true,
        providerRefundId: true,
        payment: { select: { providerPaymentIntentId: true, status: true } },
      },
    });
    if (!refund) {
      throw new AppError(404, "Refund request not found");
    }

    const expectedStatus = retry ? "FAILED" : "REQUESTED";
    if (refund.status !== expectedStatus) {
      throw new AppError(
        409,
        retry
          ? "Only a failed refund without a provider refund can be retried"
          : "Only a pending refund request can be approved",
      );
    }
    if (retry && refund.providerRefundId) {
      throw new AppError(
        409,
        "This failed provider refund cannot be retried automatically",
      );
    }
    if (refund.payment.status !== "SUCCEEDED") {
      throw new AppError(
        409,
        "The payment is no longer eligible for this refund",
      );
    }
    if (!refund.payment.providerPaymentIntentId) {
      throw new AppError(
        409,
        "Stripe PaymentIntent is missing for this payment",
      );
    }

    const claimed = await tx.refund.updateMany({
      where: { id: refund.id, status: expectedStatus, providerRefundId: null },
      data: {
        status: "APPROVED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        adminNote: note,
        failureReason: null,
      },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        409,
        "Refund request state changed; retry the request",
      );
    }

    await AuditService.create(tx, {
      actorId: adminId,
      action: retry ? "REFUND_PROVIDER_RETRY_APPROVED" : "REFUND_APPROVED",
      entityType: "Refund",
      entityId: refund.id,
      metadata: {
        paymentId: refund.paymentId,
        invoiceId: refund.invoiceId,
        amount: Number(refund.amount),
      },
      ...context,
    });

    return refund;
  });
};

const markProviderCallFailed = async (
  refundId: string,
  adminId: string,
  message: string,
  context: AuditContext,
) => {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        requestedById: true,
        paymentId: true,
        invoiceId: true,
        providerRefundId: true,
      },
    });
    if (!refund || refund.providerRefundId) {
      return;
    }

    const failed = await tx.refund.updateMany({
      where: { id: refundId, status: "APPROVED", providerRefundId: null },
      data: {
        status: "FAILED",
        failureReason: message.slice(0, 1000),
        providerStatus: "api_error",
      },
    });
    if (failed.count !== 1) {
      return;
    }

    await AuditService.create(tx, {
      actorId: adminId,
      action: "REFUND_PROVIDER_REQUEST_FAILED",
      entityType: "Refund",
      entityId: refundId,
      metadata: {
        paymentId: refund.paymentId,
        invoiceId: refund.invoiceId,
        reason: message.slice(0, 500),
      },
      ...context,
    });
    await tx.notification.create({
      data: {
        userId: refund.requestedById,
        type: "REFUND_PROCESSING_FAILED",
        title: "Refund processing failed",
        message:
          "The refund could not be submitted to the payment provider and will be reviewed again.",
        metadata: {
          refundId,
          paymentId: refund.paymentId,
          invoiceId: refund.invoiceId,
        },
      },
    });
  });
};

const persistProviderRefund = async (
  adminId: string,
  refundId: string,
  providerRefund: Stripe.Refund,
  context: AuditContext,
) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.refund.findUnique({
      where: { id: refundId },
      select: {
        id: true,
        status: true,
        requestedById: true,
        paymentId: true,
        invoiceId: true,
        providerRefundId: true,
        invoice: { select: { supplierId: true, invoiceNumber: true } },
      },
    });
    if (!existing) {
      throw new AppError(404, "Refund request not found");
    }
    if (
      existing.providerRefundId &&
      existing.providerRefundId !== providerRefund.id
    ) {
      throw new AppError(
        409,
        "Refund request is already linked to a different Stripe refund",
      );
    }

    const nextStatus = mapStripeRefundStatus(
      providerRefund.status ?? "pending",
    );
    if (!canApplyProviderRefundStatus(existing.status, nextStatus)) {
      return tx.refund.findUniqueOrThrow({
        where: { id: refundId },
        select: refundSelect,
      });
    }
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(nextStatus);
    const claimed = await tx.refund.updateMany({
      where: {
        id: refundId,
        status: existing.status,
        OR: [
          { providerRefundId: null },
          { providerRefundId: providerRefund.id },
        ],
      },
      data: {
        status: nextStatus,
        providerRefundId: providerRefund.id,
        providerStatus: providerRefund.status ?? "unknown",
        failureReason: providerRefund.failure_reason ?? null,
        completedAt: terminal ? new Date() : null,
      },
    });
    if (claimed.count !== 1) {
      return tx.refund.findUniqueOrThrow({
        where: { id: refundId },
        select: refundSelect,
      });
    }

    const reconciliation = await reconcilePaymentRefundStatus(
      tx,
      existing.paymentId,
    );
    const auditAction =
      nextStatus === "SUCCEEDED"
        ? "REFUND_SUCCEEDED"
        : nextStatus === "FAILED" || nextStatus === "CANCELLED"
          ? "REFUND_FAILED"
          : "REFUND_SUBMITTED_TO_PROVIDER";
    await AuditService.create(tx, {
      actorId: adminId,
      action: auditAction,
      entityType: "Refund",
      entityId: refundId,
      metadata: {
        paymentId: existing.paymentId,
        invoiceId: existing.invoiceId,
        providerRefundId: providerRefund.id,
        providerStatus: providerRefund.status,
        fullyRefunded: reconciliation.fullyRefunded,
      },
      ...context,
    });

    if (nextStatus === "SUCCEEDED") {
      await tx.notification.createMany({
        data: [
          {
            userId: existing.requestedById,
            type: "REFUND_SUCCEEDED",
            title: "Refund completed",
            message: `Your refund for ${existing.invoice.invoiceNumber} has completed successfully.`,
            metadata: {
              refundId,
              paymentId: existing.paymentId,
              invoiceId: existing.invoiceId,
            },
          },
          {
            userId: existing.invoice.supplierId,
            type: "REFUND_SUCCEEDED",
            title: "Payment refunded",
            message: `A refund for ${existing.invoice.invoiceNumber} has completed.`,
            metadata: {
              refundId,
              paymentId: existing.paymentId,
              invoiceId: existing.invoiceId,
            },
          },
        ],
      });
    } else if (nextStatus === "FAILED" || nextStatus === "CANCELLED") {
      await tx.notification.create({
        data: {
          userId: existing.requestedById,
          type: "REFUND_FAILED",
          title: "Refund could not be completed",
          message: `The refund for ${existing.invoice.invoiceNumber} could not be completed.`,
          metadata: {
            refundId,
            paymentId: existing.paymentId,
            invoiceId: existing.invoiceId,
          },
        },
      });
    }

    return tx.refund.findUniqueOrThrow({
      where: { id: refundId },
      select: refundSelect,
    });
  });
};

const submitToStripe = async (
  adminId: string,
  refundId: string,
  note: string | undefined,
  retry: boolean,
  context: AuditContext,
) => {
  const prepared = await prepareProviderRefund(
    adminId,
    refundId,
    note,
    retry,
    context,
  );
  const stripe = getStripeClient();
  const paymentIntentId = prepared.payment.providerPaymentIntentId;
  if (!paymentIntentId) {
    throw new AppError(409, "Stripe PaymentIntent is missing for this payment");
  }

  let providerRefund: Stripe.Refund;
  try {
    providerRefund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: toStripeMinorUnits(
          prepared.amount.toString(),
          prepared.currency,
        ),
        reason: "requested_by_customer",
        metadata: {
          refundRequestId: prepared.id,
          paymentId: prepared.paymentId,
          invoiceId: prepared.invoiceId,
          buyerId: prepared.requestedById,
        },
      },
      { idempotencyKey: prepared.idempotencyKey },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe refund request failed";
    await markProviderCallFailed(refundId, adminId, message, context);
    throw new AppError(502, "Unable to submit refund to Stripe");
  }

  return persistProviderRefund(adminId, refundId, providerRefund, context);
};

const approve = (
  adminId: string,
  refundId: string,
  note: string | undefined,
  context: AuditContext,
) => submitToStripe(adminId, refundId, note, false, context);

const retry = (adminId: string, refundId: string, context: AuditContext) =>
  submitToStripe(adminId, refundId, undefined, true, context);

export const RefundService = {
  requestRefund,
  listMine,
  getMineById,
  cancelMine,
  listAdmin,
  getAdminById,
  reject,
  approve,
  retry,
};
