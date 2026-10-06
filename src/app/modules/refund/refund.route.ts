import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { RefundController } from "./refund.controller.js";
import {
  approveRefundSchema,
  rejectRefundSchema,
  requestRefundSchema,
} from "./refund.validation.js";

const paymentRefundRouter = Router();
paymentRefundRouter.post(
  "/:paymentId/refunds",
  requireAuth,
  requireRoles("BUYER"),
  validateBody(requestRefundSchema),
  RefundController.requestRefund,
);

const refundRouter = Router();
refundRouter.get(
  "/",
  requireAuth,
  requireRoles("BUYER"),
  RefundController.listMine,
);
refundRouter.get(
  "/:refundId",
  requireAuth,
  requireRoles("BUYER"),
  RefundController.getMineById,
);
refundRouter.post(
  "/:refundId/cancel",
  requireAuth,
  requireRoles("BUYER"),
  RefundController.cancelMine,
);

const adminRefundRouter = Router();
adminRefundRouter.get(
  "/",
  requireAuth,
  requireRoles("ADMIN"),
  RefundController.listAdmin,
);
adminRefundRouter.get(
  "/:refundId",
  requireAuth,
  requireRoles("ADMIN"),
  RefundController.getAdminById,
);
adminRefundRouter.post(
  "/:refundId/approve",
  requireAuth,
  requireRoles("ADMIN"),
  validateBody(approveRefundSchema),
  RefundController.approve,
);
adminRefundRouter.post(
  "/:refundId/reject",
  requireAuth,
  requireRoles("ADMIN"),
  validateBody(rejectRefundSchema),
  RefundController.reject,
);
adminRefundRouter.post(
  "/:refundId/retry",
  requireAuth,
  requireRoles("ADMIN"),
  RefundController.retry,
);

export const PaymentRefundRoutes = paymentRefundRouter;
export const RefundRoutes = refundRouter;
export const AdminRefundRoutes = adminRefundRouter;
