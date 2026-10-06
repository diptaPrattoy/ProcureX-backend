import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { InvoiceController } from "./invoice.controller.js";
import {
  createInvoiceSchema,
  rejectInvoiceSchema,
} from "./invoice.validation.js";

const purchaseOrderRouter = Router();
purchaseOrderRouter.post(
  "/:purchaseOrderId/invoices",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(createInvoiceSchema),
  InvoiceController.create,
);
purchaseOrderRouter.get(
  "/:purchaseOrderId/invoices",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  InvoiceController.listByPurchaseOrder,
);

const router = Router();
router.get(
  "/",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  InvoiceController.listMine,
);
router.get(
  "/:invoiceId",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  InvoiceController.getById,
);
router.post(
  "/:invoiceId/start-review",
  requireAuth,
  requireRoles("BUYER"),
  InvoiceController.startReview,
);
router.post(
  "/:invoiceId/approve",
  requireAuth,
  requireRoles("BUYER"),
  InvoiceController.approve,
);
router.post(
  "/:invoiceId/reject",
  requireAuth,
  requireRoles("BUYER"),
  validateBody(rejectInvoiceSchema),
  InvoiceController.reject,
);
router.post(
  "/:invoiceId/cancel",
  requireAuth,
  requireRoles("SUPPLIER"),
  InvoiceController.cancel,
);

export const PurchaseOrderInvoiceRoutes = purchaseOrderRouter;
export const InvoiceRoutes = router;
