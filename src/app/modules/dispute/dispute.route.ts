import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { DisputeController } from "./dispute.controller.js";
import { openDisputeSchema, rejectDisputeSchema, resolveDisputeSchema } from "./dispute.validation.js";

const purchaseOrderDisputeRouter = Router();
purchaseOrderDisputeRouter.post(
  "/:purchaseOrderId/disputes",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  validateBody(openDisputeSchema),
  DisputeController.openForPurchaseOrder,
);

const invoiceDisputeRouter = Router();
invoiceDisputeRouter.post(
  "/:invoiceId/disputes",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  validateBody(openDisputeSchema),
  DisputeController.openForInvoice,
);

const disputeRouter = Router();
disputeRouter.get("/", requireAuth, requireRoles("BUYER", "SUPPLIER"), DisputeController.listMine);
disputeRouter.get("/:disputeId", requireAuth, requireRoles("BUYER", "SUPPLIER"), DisputeController.getMineById);

const adminDisputeRouter = Router();
adminDisputeRouter.get("/", requireAuth, requireRoles("ADMIN"), DisputeController.listAdmin);
adminDisputeRouter.get("/:disputeId", requireAuth, requireRoles("ADMIN"), DisputeController.getAdminById);
adminDisputeRouter.post(
  "/:disputeId/review",
  requireAuth,
  requireRoles("ADMIN"),
  DisputeController.startReview,
);
adminDisputeRouter.post(
  "/:disputeId/resolve",
  requireAuth,
  requireRoles("ADMIN"),
  validateBody(resolveDisputeSchema),
  DisputeController.resolve,
);
adminDisputeRouter.post(
  "/:disputeId/reject",
  requireAuth,
  requireRoles("ADMIN"),
  validateBody(rejectDisputeSchema),
  DisputeController.reject,
);

export const PurchaseOrderDisputeRoutes = purchaseOrderDisputeRouter;
export const InvoiceDisputeRoutes = invoiceDisputeRouter;
export const DisputeRoutes = disputeRouter;
export const AdminDisputeRoutes = adminDisputeRouter;
