import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import {
  assertInvoiceCanEnterPayment,
  isCheckoutSessionExpired,
  isReusableCheckoutStatus,
  toStripeMinorUnits,
} from "./payment.domain.js";
import type { PaymentListQuery } from "./payment.validation.js";
import { getStripeClient } from "./stripe.client.js";

const paymentListSelect = {
  id: true,
  invoiceId: true,
  buyerId: true,
  provider: true,
  status: true,
  currency: true,
  amount: true,
  providerPaymentIntentId: true,
  providerCheckoutSessionId: true,
  failureReason: true,
  receiptUrl: true,
  initiatedAt: true,
  completedAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
  invoice: {
    select: {
      invoiceNumber: true,
      status: true,
      totalAmount: true,
      dueDate: true,
      supplier: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          supplierProfile: { select: { companyName: true } },
        },
      },
    },
  },
} as const;

type PreparedPayment = {
  amountMinor: number;
  payment: {
    id: string;
    invoiceId: string;
    buyerId: string;
    status:
      | "PENDING"
      | "PROCESSING"
      | "SUCCEEDED"
      | "FAILED"
      | "CANCELLED"
      | "REFUNDED";
    currency: string;
    amount: Prisma.Decimal;
    idempotencyKey: string;
    providerCheckoutSessionId: string | null;
    providerMetadata: Prisma.JsonValue | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    buyerId: string;
    supplierId: string;
    currency: string;
    totalAmount: Prisma.Decimal;
    status:
      | "SUBMITTED"
      | "UNDER_REVIEW"
      | "APPROVED"
      | "REJECTED"
      | "PAYMENT_PENDING"
      | "PAID"
      | "CANCELLED";
    purchaseOrder: { poNumber: string };
    buyer: { email: string };
  };
};

type CheckoutResult = {
  paymentId: string;
  invoiceId: string;
  status: PreparedPayment["payment"]["status"];
  checkoutSessionId: string;
  checkoutUrl: string;
  expiresAt: number | null;
  reused: boolean;
};

const readCheckoutMetadata = (value: Prisma.JsonValue | null) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as { checkoutUrl?: string; expiresAt?: number };
  }
  const object = value as Record<string, unknown>;
  return {
    checkoutUrl:
      typeof object.checkoutUrl === "string" ? object.checkoutUrl : undefined,
    expiresAt:
      typeof object.expiresAt === "number" ? object.expiresAt : undefined,
  };
};

const preparePayment = async (
  buyerId: string,
  invoiceId: string,
  context: AuditContext,
): Promise<PreparedPayment> => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, buyerId },
      select: {
        id: true,
        invoiceNumber: true,
        buyerId: true,
        supplierId: true,
        currency: true,
        totalAmount: true,
        status: true,
        purchaseOrder: { select: { poNumber: true } },
        buyer: { select: { email: true } },
      },
    });

    if (!invoice) {
      throw new AppError(404, "Invoice not found");
    }
    assertInvoiceCanEnterPayment(invoice.status);
    const amountMinor = toStripeMinorUnits(
      invoice.totalAmount.toString(),
      invoice.currency,
    );

    if (invoice.status === "PAYMENT_PENDING") {
      const existingPayment = await tx.payment.findFirst({
        where: {
          invoiceId: invoice.id,
          buyerId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceId: true,
          buyerId: true,
          status: true,
          currency: true,
          amount: true,
          idempotencyKey: true,
          providerCheckoutSessionId: true,
          providerMetadata: true,
        },
      });

      if (existingPayment && isReusableCheckoutStatus(existingPayment.status)) {
        return { payment: existingPayment, invoice, amountMinor };
      }

      throw new AppError(
        409,
        "Invoice has a pending payment state but no reusable payment attempt",
      );
    }

    const claimed = await tx.invoice.updateMany({
      where: { id: invoice.id, buyerId, status: "APPROVED" },
      data: { status: "PAYMENT_PENDING" },
    });
    if (claimed.count !== 1) {
      throw new AppError(
        409,
        "Invoice payment state changed; retry the request",
      );
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        buyerId,
        provider: "STRIPE",
        status: "PENDING",
        currency: invoice.currency,
        amount: invoice.totalAmount,
        idempotencyKey: `stripe-checkout:${invoice.id}:${randomUUID()}`,
      },
      select: {
        id: true,
        invoiceId: true,
        buyerId: true,
        status: true,
        currency: true,
        amount: true,
        idempotencyKey: true,
        providerCheckoutSessionId: true,
        providerMetadata: true,
      },
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "PAYMENT_INITIATED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.totalAmount),
        currency: invoice.currency,
      },
      ...context,
    });

    return {
      payment,
      invoice: { ...invoice, status: "PAYMENT_PENDING" },
      amountMinor,
    };
  });
};

const markCheckoutCreationFailed = async (
  paymentId: string,
  invoiceId: string,
  buyerId: string,
  reason: string,
  context: AuditContext,
) => {
  await prisma.$transaction(async (tx) => {
    const failed = await tx.payment.updateMany({
      where: {
        id: paymentId,
        buyerId,
        status: "PENDING",
        providerCheckoutSessionId: null,
      },
      data: { status: "FAILED", failureReason: reason.slice(0, 1000) },
    });

    if (failed.count !== 1) {
      return;
    }

    await tx.invoice.updateMany({
      where: { id: invoiceId, buyerId, status: "PAYMENT_PENDING" },
      data: { status: "APPROVED" },
    });

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "PAYMENT_CHECKOUT_CREATION_FAILED",
      entityType: "Payment",
      entityId: paymentId,
      metadata: { invoiceId, reason: reason.slice(0, 500) },
      ...context,
    });
  });
};

const expireCheckoutAttempt = async (
  prepared: PreparedPayment,
  buyerId: string,
  context: AuditContext,
  stripe: Stripe,
) => {
  const checkoutSessionId = prepared.payment.providerCheckoutSessionId;
  if (!checkoutSessionId) {
    throw new AppError(409, "Checkout session is missing; retry the request");
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  } catch {
    throw new AppError(502, "Unable to confirm the Stripe checkout status");
  }

  if (session.payment_status === "paid" || session.status === "complete") {
    throw new AppError(
      409,
      "Checkout is complete and payment confirmation is pending",
    );
  }
  if (session.status === "open") {
    try {
      session = await stripe.checkout.sessions.expire(checkoutSessionId);
    } catch {
      throw new AppError(502, "Unable to expire the Stripe checkout session");
    }
  }
  if (session.status !== "expired") {
    throw new AppError(409, "Checkout cannot be renewed in its current state");
  }

  await prisma.$transaction(async (tx) => {
    const cancelled = await tx.payment.updateMany({
      where: {
        id: prepared.payment.id,
        buyerId,
        status: { in: ["PENDING", "PROCESSING"] },
        providerCheckoutSessionId: checkoutSessionId,
      },
      data: {
        status: "CANCELLED",
        failureReason: "Stripe Checkout session expired",
      },
    });
    if (cancelled.count !== 1) {
      throw new AppError(409, "Payment state changed; retry the request");
    }

    const released = await tx.invoice.updateMany({
      where: {
        id: prepared.invoice.id,
        buyerId,
        status: "PAYMENT_PENDING",
      },
      data: { status: "APPROVED" },
    });
    if (released.count !== 1) {
      throw new AppError(
        409,
        "Invoice payment state changed; retry the request",
      );
    }

    await AuditService.create(tx, {
      actorId: buyerId,
      action: "PAYMENT_CHECKOUT_EXPIRED",
      entityType: "Payment",
      entityId: prepared.payment.id,
      metadata: {
        invoiceId: prepared.invoice.id,
        invoiceNumber: prepared.invoice.invoiceNumber,
        checkoutSessionId,
      },
      ...context,
    });
  });
};

const createCheckout = async (
  buyerId: string,
  invoiceId: string,
  context: AuditContext,
): Promise<CheckoutResult> => {
  const prepared = await preparePayment(buyerId, invoiceId, context);
  const metadata = readCheckoutMetadata(prepared.payment.providerMetadata);
  const stripe = getStripeClient();

  if (prepared.payment.providerCheckoutSessionId && metadata.checkoutUrl) {
    if (!isCheckoutSessionExpired(metadata.expiresAt)) {
      return {
        paymentId: prepared.payment.id,
        invoiceId: prepared.invoice.id,
        status: prepared.payment.status,
        checkoutSessionId: prepared.payment.providerCheckoutSessionId,
        checkoutUrl: metadata.checkoutUrl,
        expiresAt: metadata.expiresAt ?? null,
        reused: true,
      };
    }

    await expireCheckoutAttempt(prepared, buyerId, context, stripe);
    return createCheckout(buyerId, invoiceId, context);
  }

  const paymentMetadata = {
    paymentId: prepared.payment.id,
    invoiceId: prepared.invoice.id,
    buyerId,
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: prepared.payment.id,
        customer_email: prepared.invoice.buyer.email,
        success_url: env.STRIPE_SUCCESS_URL,
        cancel_url: env.STRIPE_CANCEL_URL,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: prepared.invoice.currency.toLowerCase(),
              unit_amount: prepared.amountMinor,
              product_data: {
                name: `ProcuraX invoice ${prepared.invoice.invoiceNumber}`,
                description: `Purchase order ${prepared.invoice.purchaseOrder.poNumber}`,
              },
            },
          },
        ],
        metadata: paymentMetadata,
        payment_intent_data: { metadata: paymentMetadata },
      },
      { idempotencyKey: prepared.payment.idempotencyKey },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe checkout creation failed";
    await markCheckoutCreationFailed(
      prepared.payment.id,
      prepared.invoice.id,
      buyerId,
      message,
      context,
    );
    throw new AppError(502, "Unable to create Stripe checkout session");
  }

  if (!session.url) {
    await markCheckoutCreationFailed(
      prepared.payment.id,
      prepared.invoice.id,
      buyerId,
      "Stripe checkout session did not return a URL",
      context,
    );
    throw new AppError(502, "Stripe did not return a checkout URL");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: {
        id: prepared.payment.id,
        status: { in: ["PENDING", "PROCESSING"] },
        providerCheckoutSessionId: null,
      },
      data: {
        status: "PROCESSING",
        providerCheckoutSessionId: session.id,
        providerMetadata: {
          checkoutUrl: session.url,
          expiresAt: session.expires_at,
          amountMinor: prepared.amountMinor,
        },
      },
    });

    if (claimed.count === 1) {
      await AuditService.create(tx, {
        actorId: buyerId,
        action: "STRIPE_CHECKOUT_CREATED",
        entityType: "Payment",
        entityId: prepared.payment.id,
        metadata: {
          invoiceId: prepared.invoice.id,
          checkoutSessionId: session.id,
          expiresAt: session.expires_at,
        },
        ...context,
      });

      await tx.notification.create({
        data: {
          userId: prepared.invoice.supplierId,
          type: "PAYMENT_INITIATED",
          title: "Payment initiated",
          message: `Payment has been initiated for ${prepared.invoice.invoiceNumber}.`,
          metadata: {
            paymentId: prepared.payment.id,
            invoiceId: prepared.invoice.id,
            invoiceNumber: prepared.invoice.invoiceNumber,
          },
        },
      });
    }

    return tx.payment.findUniqueOrThrow({
      where: { id: prepared.payment.id },
      select: { id: true, status: true },
    });
  });

  return {
    paymentId: updated.id,
    invoiceId: prepared.invoice.id,
    status: updated.status,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: session.expires_at,
    reused: false,
  };
};

const listMine = async (buyerId: string, query: PaymentListQuery) => {
  const where: Prisma.PaymentWhereInput = {
    buyerId,
    ...(query.status ? { status: query.status } : {}),
  };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: paymentListSelect,
      orderBy: { createdAt: query.sortOrder },
      skip,
      take: query.limit,
    }),
    prisma.payment.count({ where }),
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

const getMineById = async (buyerId: string, paymentId: string) => {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, buyerId },
    select: paymentListSelect,
  });
  if (!payment) {
    throw new AppError(404, "Payment not found");
  }
  return payment;
};

export const PaymentService = {
  createCheckout,
  listMine,
  getMineById,
};
