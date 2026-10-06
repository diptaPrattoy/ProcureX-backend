import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { PaymentController } from "./payment.controller.js";

const invoicePaymentRouter = Router();
invoicePaymentRouter.post(
  "/:invoiceId/payments/checkout",
  requireAuth,
  requireRoles("BUYER"),
  PaymentController.createCheckout,
);

const paymentRouter = Router();
paymentRouter.get(
  "/",
  requireAuth,
  requireRoles("BUYER"),
  PaymentController.listMine,
);
paymentRouter.get(
  "/:paymentId",
  requireAuth,
  requireRoles("BUYER"),
  PaymentController.getMineById,
);

export const InvoicePaymentRoutes = invoicePaymentRouter;
export const PaymentRoutes = paymentRouter;
