import { Router } from "express";
import { HealthRoutes } from "../modules/health/health.route.js";

const router = Router();

router.use("/health", HealthRoutes);

export const apiRouter = router;
