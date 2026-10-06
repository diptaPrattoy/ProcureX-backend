import type Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AuditService } from "../audit/audit.service.js";
import {
  canApplyProviderRefundStatus,
  mapStripeRefundStatus,
} from "../refund/refund.domain.js";
import { reconcilePaymentRefundStatus } from "../refund/refund.reconciliation.js";

type WebhookTransaction = Prisma.TransactionClient;

const jsonPayload = (event: Stripe.Event): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;

const paymentIntentIdFromSession = (session: Stripe.Checkout.Session) => {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
};

const paymentIdFromMetadata = (
  metadata: Record<string, string> | null | undefined,
) => metadata?.paymentId?.trim() || null;

const refundRequestIdFromMetadata = (
  metadata: Record<string, string> | null | undefined,
) => metadata?.refundRequestId?.trim() || null;

const applyRefundUpdate = async (
  tx: WebhookTransaction,
  providerRefund: Stripe.Refund,
) => {
  const refundRequestId = refundRequestIdFromMetadata(providerRefund.metadata);
  const localRefund = refundRequestId
    ? await tx.refund.findUnique({
        where: { id: refundRequestId },
        select: {
          id: true,
          paymentId: true,
          invoiceId: true,
          requestedById: true,
          status: true,
          providerRefundId: true,
          invoice: { select: { supplierId: true, invoiceNumber: true } },
        },
      })
    : await tx.refund.findUnique({
        where: { providerRefundId: providerRefund.id },
        select: {
          id: true,
          paymentId: true,
          invoiceId: true,
          requestedById: true,
          status: true,
          providerRefundId: true,
          invoice: { select: { supplierId: true, invoiceNumber: true } },
        },
      });

  if (
    !localRefund ||
    localRefund.status === "REJECTED" ||
    localRefund.status === "CANCELLED"
  ) {
    return;
  }
  if (
    localRefund.providerRefundId &&
    localRefund.providerRefundId !== providerRefund.id
  ) {
    return;
  }

  const nextStatus = mapStripeRefundStatus(providerRefund.status ?? "pending");
  const previousStatus = localRefund.status;
  if (!canApplyProviderRefundStatus(previousStatus, nextStatus)) {
    return;
  }
  const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(nextStatus);

  const claimed = await tx.refund.updateMany({
    where: {
      id: localRefund.id,
      status: previousStatus,
      OR: [{ providerRefundId: null }, { providerRefundId: providerRefund.id }],
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
    return;
  }

  const reconciliation = await reconcilePaymentRefundStatus(
    tx,
    localRefund.paymentId,
  );

  const action =
    nextStatus === "SUCCEEDED"
      ? "REFUND_SUCCEEDED"
      : nextStatus === "FAILED" || nextStatus === "CANCELLED"
        ? "REFUND_FAILED"
        : "REFUND_PROVIDER_UPDATED";

  await AuditService.create(tx, {
    action,
    entityType: "Refund",
    entityId: localRefund.id,
    metadata: {
      paymentId: localRefund.paymentId,
      invoiceId: localRefund.invoiceId,
      providerRefundId: providerRefund.id,
      providerStatus: providerRefund.status,
      fullyRefunded: reconciliation.fullyRefunded,
    },
  });

  if (nextStatus === "SUCCEEDED") {
    await tx.notification.createMany({
      data: [
        {
          userId: localRefund.requestedById,
          type: "REFUND_SUCCEEDED",
          title: "Refund completed",
          message: `Your refund for ${localRefund.invoice.invoiceNumber} has completed successfully.`,
          metadata: {
            refundId: localRefund.id,
            paymentId: localRefund.paymentId,
            invoiceId: localRefund.invoiceId,
          },
        },
        {
          userId: localRefund.invoice.supplierId,
          type: "REFUND_SUCCEEDED",
          title: "Payment refunded",
          message: `A refund for ${localRefund.invoice.invoiceNumber} has completed.`,
          metadata: {
            refundId: localRefund.id,
            paymentId: localRefund.paymentId,
            invoiceId: localRefund.invoiceId,
          },
        },
      ],
    });
  } else if (nextStatus === "FAILED" || nextStatus === "CANCELLED") {
    await tx.notification.create({
      data: {
        userId: localRefund.requestedById,
        type: "REFUND_FAILED",
        title: "Refund could not be completed",
        message: `The refund for ${localRefund.invoice.invoiceNumber} could not be completed.`,
        metadata: {
          refundId: localRefund.id,
          paymentId: localRefund.paymentId,
          invoiceId: localRefund.invoiceId,
        },
      },
    });
  }
};

const markSucceeded = async (
  tx: WebhookTransaction,
  paymentId: string,
  providerPaymentIntentId?: string | null,
  providerCheckoutSessionId?: string | null,
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      invoiceId: true,
      buyerId: true,
      status: true,
      providerPaymentIntentId: true,
      providerCheckoutSessionId: true,
      invoice: {
        select: {
          invoiceNumber: true,
          supplierId: true,
          status: true,
        },
      },
    },
  });

  if (
    !payment ||
    payment.status === "SUCCEEDED" ||
    payment.status === "REFUNDED"
  ) {
    return;
  }

  const now = new Date();
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      failureReason: null,
      completedAt: now,
      providerPaymentIntentId:
        providerPaymentIntentId ?? payment.providerPaymentIntentId,
      providerCheckoutSessionId:
        providerCheckoutSessionId ?? payment.providerCheckoutSessionId,
    },
  });

  await tx.invoice.updateMany({
    where: { id: payment.invoiceId, status: "PAYMENT_PENDING" },
    data: { status: "PAID", paidAt: now },
  });

  await AuditService.create(tx, {
    action: "PAYMENT_SUCCEEDED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      providerPaymentIntentId:
        providerPaymentIntentId ?? payment.providerPaymentIntentId,
    },
  });

  await tx.notification.create({
    data: {
      userId: payment.invoice.supplierId,
      type: "PAYMENT_SUCCEEDED",
      title: "Invoice paid",
      message: `${payment.invoice.invoiceNumber} has been paid successfully.`,
      metadata: { paymentId: payment.id, invoiceId: payment.invoiceId },
    },
  });
};

const markFailed = async (
  tx: WebhookTransaction,
  paymentId: string,
  reason: string,
  providerPaymentIntentId?: string | null,
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      invoiceId: true,
      buyerId: true,
      status: true,
      providerPaymentIntentId: true,
      invoice: { select: { invoiceNumber: true } },
    },
  });

  if (
    !payment ||
    payment.status === "SUCCEEDED" ||
    payment.status === "REFUNDED"
  ) {
    return;
  }
  if (payment.status === "FAILED" || payment.status === "CANCELLED") {
    return;
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
      failureReason: reason.slice(0, 1000),
      providerPaymentIntentId:
        providerPaymentIntentId ?? payment.providerPaymentIntentId,
    },
  });
  await tx.invoice.updateMany({
    where: {
      id: payment.invoiceId,
      buyerId: payment.buyerId,
      status: "PAYMENT_PENDING",
    },
    data: { status: "APPROVED" },
  });

  await AuditService.create(tx, {
    action: "PAYMENT_FAILED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      reason: reason.slice(0, 500),
    },
  });

  await tx.notification.create({
    data: {
      userId: payment.buyerId,
      type: "PAYMENT_FAILED",
      title: "Payment failed",
      message: `Payment for ${payment.invoice.invoiceNumber} failed. You can try again.`,
      metadata: { paymentId: payment.id, invoiceId: payment.invoiceId },
    },
  });
};

const markCancelled = async (tx: WebhookTransaction, paymentId: string) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      invoiceId: true,
      buyerId: true,
      status: true,
      invoice: { select: { invoiceNumber: true } },
    },
  });

  if (
    !payment ||
    payment.status === "SUCCEEDED" ||
    payment.status === "REFUNDED"
  ) {
    return;
  }
  if (payment.status === "CANCELLED") {
    return;
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELLED",
      failureReason: "Stripe Checkout session expired",
    },
  });
  await tx.invoice.updateMany({
    where: {
      id: payment.invoiceId,
      buyerId: payment.buyerId,
      status: "PAYMENT_PENDING",
    },
    data: { status: "APPROVED" },
  });

  await AuditService.create(tx, {
    action: "PAYMENT_CHECKOUT_EXPIRED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: {
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
    },
  });
};

const applyStripeEvent = async (
  tx: WebhookTransaction,
  event: Stripe.Event,
) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(session.metadata);
      if (!paymentId || session.payment_status !== "paid") {
        return;
      }
      await markSucceeded(
        tx,
        paymentId,
        paymentIntentIdFromSession(session),
        session.id,
      );
      return;
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(session.metadata);
      if (paymentId) {
        await markFailed(
          tx,
          paymentId,
          "Stripe reported asynchronous payment failure",
          paymentIntentIdFromSession(session),
        );
      }
      return;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = paymentIdFromMetadata(session.metadata);
      if (paymentId) {
        await markCancelled(tx, paymentId);
      }
      return;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIdFromMetadata(intent.metadata);
      if (paymentId) {
        await markSucceeded(tx, paymentId, intent.id);
      }
      return;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = paymentIdFromMetadata(intent.metadata);
      if (paymentId) {
        await markFailed(
          tx,
          paymentId,
          intent.last_payment_error?.message ?? "Stripe payment failed",
          intent.id,
        );
      }
      return;
    }
    case "refund.created":
    case "refund.updated":
    case "refund.failed": {
      const providerRefund = event.data.object as Stripe.Refund;
      await applyRefundUpdate(tx, providerRefund);
      return;
    }
    default:
      return;
  }
};

const processEvent = async (event: Stripe.Event) => {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.webhookEvent.findUnique({
          where: { providerEventId: event.id },
          select: { id: true, processedAt: true },
        });

        if (existing?.processedAt) {
          return { duplicate: true, processed: true };
        }

        if (!existing) {
          await tx.webhookEvent.create({
            data: {
              provider: "STRIPE",
              providerEventId: event.id,
              eventType: event.type,
              payload: jsonPayload(event),
            },
          });
        }

        await applyStripeEvent(tx, event);

        await tx.webhookEvent.update({
          where: { providerEventId: event.id },
          data: { processedAt: new Date(), processingError: null },
        });

        return { duplicate: false, processed: true };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    const code =
      error instanceof Error
        ? (error as Error & { code?: string }).code
        : undefined;
    if (code === "P2002") {
      const existing = await prisma.webhookEvent.findUnique({
        where: { providerEventId: event.id },
        select: { processedAt: true },
      });
      if (existing?.processedAt) {
        return { duplicate: true, processed: true };
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown webhook processing error";
    await prisma.webhookEvent.upsert({
      where: { providerEventId: event.id },
      create: {
        provider: "STRIPE",
        providerEventId: event.id,
        eventType: event.type,
        payload: jsonPayload(event),
        processingError: message.slice(0, 2000),
      },
      update: { processingError: message.slice(0, 2000) },
    });
    throw error;
  }
};

export const PaymentWebhookService = { processEvent };
