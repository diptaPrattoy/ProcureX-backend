import type { Prisma } from "../../../generated/prisma/client.js";
import { toStripeMinorUnits } from "../payment/payment.domain.js";

export const reconcilePaymentRefundStatus = async (
  tx: Prisma.TransactionClient,
  paymentId: string,
) => {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      refundedAt: true,
    },
  });
  if (!payment) {
    return { fullyRefunded: false, refundedMinor: 0, paymentMinor: 0 };
  }

  const successful = await tx.refund.aggregate({
    where: { paymentId, status: "SUCCEEDED" },
    _sum: { amount: true },
  });

  const paymentMinor = toStripeMinorUnits(
    payment.amount.toString(),
    payment.currency,
  );
  const refundedMinor = successful._sum.amount
    ? toStripeMinorUnits(successful._sum.amount.toString(), payment.currency)
    : 0;
  const fullyRefunded = refundedMinor >= paymentMinor;

  if (fullyRefunded && payment.status !== "REFUNDED") {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
  } else if (!fullyRefunded && payment.status === "REFUNDED") {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "SUCCEEDED", refundedAt: null },
    });
  }

  return { fullyRefunded, refundedMinor, paymentMinor };
};
