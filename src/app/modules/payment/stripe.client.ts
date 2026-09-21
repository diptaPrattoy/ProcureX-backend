import Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";

let stripeClient: Stripe | undefined;

export const getStripeClient = (): Stripe => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, "Stripe payment processing is not configured");
  }

  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 10_000,
  });

  return stripeClient;
};
