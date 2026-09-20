import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { HealthRoutes } from "../modules/health/health.route.js";

const router = Router();

router.use("/health", HealthRoutes);
router.use("/auth", AuthRoutes);

export const apiRouter = router;
