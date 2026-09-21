import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { GoodsReceiptController } from "./goods-receipt.controller.js";
import { createGoodsReceiptSchema } from "./goods-receipt.validation.js";

const purchaseOrderRouter = Router();

purchaseOrderRouter.post(
  "/:purchaseOrderId/goods-receipts",
  requireAuth,
  requireRoles("BUYER"),
  validateBody(createGoodsReceiptSchema),
  GoodsReceiptController.create,
);
purchaseOrderRouter.get(
  "/:purchaseOrderId/goods-receipts",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  GoodsReceiptController.listByPurchaseOrder,
);

const router = Router();
router.get(
  "/:goodsReceiptId",
  requireAuth,
  requireRoles("BUYER", "SUPPLIER"),
  GoodsReceiptController.getById,
);

export const PurchaseOrderGoodsReceiptRoutes = purchaseOrderRouter;
export const GoodsReceiptRoutes = router;
