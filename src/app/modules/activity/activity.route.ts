import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { ActivityController } from "./activity.controller.js";

const activityRouter = Router();
activityRouter.get("/me", requireAuth, ActivityController.listMine);

const adminAuditRouter = Router();
adminAuditRouter.get(
  "/",
  requireAuth,
  requireRoles("ADMIN"),
  ActivityController.listAdmin,
);
adminAuditRouter.get(
  "/:auditLogId",
  requireAuth,
  requireRoles("ADMIN"),
  ActivityController.getAdminById,
);

export const ActivityRoutes = activityRouter;
export const AdminAuditRoutes = adminAuditRouter;
