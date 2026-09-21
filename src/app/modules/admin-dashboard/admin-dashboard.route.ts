import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { AdminDashboardController } from "./admin-dashboard.controller.js";

const router = Router();
router.use(requireAuth, requireRoles("ADMIN"));

router.get("/overview", AdminDashboardController.overview);
router.get("/financials", AdminDashboardController.financials);
router.get("/trends", AdminDashboardController.trends);

export const AdminDashboardRoutes = router;
