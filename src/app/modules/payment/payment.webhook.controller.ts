import type { Request, Response } from "express";
import type Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { PaymentWebhookService } from "./payment.webhook.service.js";
import { getStripeClient } from "./stripe.client.js";

const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(503, "Stripe webhook processing is not configured");
  }

  const signature = req.header("stripe-signature");
  if (!signature) {
    throw new AppError(400, "Missing Stripe-Signature header");
  }
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(400, "Stripe webhook requires the raw request body");
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Invalid Stripe webhook signature");
  }

  const result = await PaymentWebhookService.processEvent(event);
  res.status(200).json({ received: true, ...result });
});

export const PaymentWebhookController = { handleStripeWebhook };
