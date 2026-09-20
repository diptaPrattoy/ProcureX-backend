import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { QuotationController } from "./quotation.controller.js";
import { submitQuotationSchema, updateQuotationSchema } from "./quotation.validation.js";

const rfqRouter = Router();
const quotationRouter = Router();

rfqRouter.post(
  "/:rfqId/quotations",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(submitQuotationSchema),
  QuotationController.submit,
);

quotationRouter.get("/mine", requireAuth, requireRoles("SUPPLIER"), QuotationController.listMine);
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
