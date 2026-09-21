import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { PurchaseOrderController } from "./purchase-order.controller.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  PurchaseOrderController.listMine,
);
router.get(
  "/:purchaseOrderId",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  PurchaseOrderController.getMineById,
);
router.post(
  "/:purchaseOrderId/accept",
  requireAuth,
  requireRoles("SUPPLIER"),
  PurchaseOrderController.accept,
);
router.post(
  "/:purchaseOrderId/reject",
  requireAuth,
  requireRoles("SUPPLIER"),
  PurchaseOrderController.reject,
);
router.post(
  "/:purchaseOrderId/start-fulfillment",
  requireAuth,
  requireRoles("SUPPLIER"),
  PurchaseOrderController.startFulfillment,
);
router.post(
  "/:purchaseOrderId/cancel",
  requireAuth,
  requireRoles("BUYER"),
  PurchaseOrderController.cancel,
);

export const PurchaseOrderRoutes = router;
