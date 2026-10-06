import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { BuyerQuotationController } from "./quotation.buyer.controller.js";
import { QuotationController } from "./quotation.controller.js";
import {
  submitQuotationSchema,
  updateQuotationSchema,
} from "./quotation.validation.js";

const rfqRouter = Router();
const quotationRouter = Router();

// Supplier quotation submission.
rfqRouter.post(
  "/:rfqId/quotations",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(submitQuotationSchema),
  QuotationController.submit,
);

// Buyer evaluation and award workflow.
rfqRouter.get(
  "/:rfqId/quotations",
  requireAuth,
  requireRoles("BUYER"),
  BuyerQuotationController.listForBuyer,
);
rfqRouter.get(
  "/:rfqId/quotations/:quotationId",
  requireAuth,
  requireRoles("BUYER"),
  BuyerQuotationController.getForBuyer,
);
rfqRouter.post(
  "/:rfqId/evaluation/start",
  requireAuth,
  requireRoles("BUYER"),
  BuyerQuotationController.startEvaluation,
);
rfqRouter.post(
  "/:rfqId/quotations/:quotationId/award",
  requireAuth,
  requireRoles("BUYER"),
  BuyerQuotationController.award,
);

// Supplier-owned quotation management.
quotationRouter.get(
  "/mine",
  requireAuth,
  requireRoles("SUPPLIER"),
  QuotationController.listMine,
);
quotationRouter.get(
  "/mine/:quotationId",
  requireAuth,
  requireRoles("SUPPLIER"),
  QuotationController.getMineById,
);
quotationRouter.patch(
  "/:quotationId",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(updateQuotationSchema),
  QuotationController.update,
);
quotationRouter.post(
  "/:quotationId/withdraw",
  requireAuth,
  requireRoles("SUPPLIER"),
  QuotationController.withdraw,
);

export const QuotationRfqRoutes = rfqRouter;
export const QuotationRoutes = quotationRouter;
