import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { BuyerController } from "./buyer.controller.js";
import { updateBuyerProfileSchema } from "./buyer.validation.js";

const router = Router();

router.use(requireAuth, requireRoles("BUYER"));
router.get("/me/profile", BuyerController.getMyProfile);
router.patch("/me/profile", validateBody(updateBuyerProfileSchema), BuyerController.updateMyProfile);

export const BuyerRoutes = router;
