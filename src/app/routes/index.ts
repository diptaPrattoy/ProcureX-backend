import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { BuyerRoutes } from "../modules/buyer/buyer.route.js";
import { CategoryRoutes } from "../modules/category/category.route.js";
import { HealthRoutes } from "../modules/health/health.route.js";
import { RfqRoutes } from "../modules/rfq/rfq.route.js";
import { AdminSupplierRoutes, SupplierRoutes } from "../modules/supplier/supplier.route.js";

const router = Router();

router.use("/health", HealthRoutes);
router.use("/auth", AuthRoutes);
router.use("/categories", CategoryRoutes);
router.use("/rfqs", RfqRoutes);
router.use("/buyers", BuyerRoutes);
router.use("/suppliers", SupplierRoutes);
router.use("/admin/suppliers", AdminSupplierRoutes);

export const apiRouter = router;
