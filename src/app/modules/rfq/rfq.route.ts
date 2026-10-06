import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { RfqController } from "./rfq.controller.js";
import { createRfqSchema, updateRfqSchema } from "./rfq.validation.js";

const router = Router();

// Supplier-facing opportunity discovery. Keep these routes before /:rfqId-style buyer routes.
router.get(
  "/open",
  requireAuth,
  requireRoles("SUPPLIER"),
  RfqController.listOpen,
);
router.get(
  "/open/:rfqId",
  requireAuth,
  requireRoles("SUPPLIER"),
  RfqController.getOpenById,
);

// Buyer-owned RFQ lifecycle.
router.post(
  "/",
  requireAuth,
  requireRoles("BUYER"),
  validateBody(createRfqSchema),
  RfqController.createDraft,
);
router.get("/mine", requireAuth, requireRoles("BUYER"), RfqController.listMine);
router.get(
  "/mine/:rfqId",
  requireAuth,
  requireRoles("BUYER"),
  RfqController.getMineById,
);
router.patch(
  "/:rfqId",
  requireAuth,
  requireRoles("BUYER"),
  validateBody(updateRfqSchema),
  RfqController.updateDraft,
);
router.post(
  "/:rfqId/publish",
  requireAuth,
  requireRoles("BUYER"),
  RfqController.publish,
);
router.post(
  "/:rfqId/cancel",
  requireAuth,
  requireRoles("BUYER"),
  RfqController.cancel,
);
router.delete(
  "/:rfqId",
  requireAuth,
  requireRoles("BUYER"),
  RfqController.softDelete,
);

export const RfqRoutes = router;
