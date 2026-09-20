import { Router } from "express";
import { requireAuth, requireRoles } from "../../middlewares/auth.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { SupplierController } from "./supplier.controller.js";
import {
  setSupplierCategoriesSchema,
  supplierVerificationSchema,
  updateSupplierProfileSchema,
} from "./supplier.validation.js";

const router = Router();

router.get("/", SupplierController.listVerified);
router.get("/me/profile", requireAuth, requireRoles("SUPPLIER"), SupplierController.getMyProfile);
router.patch(
  "/me/profile",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(updateSupplierProfileSchema),
  SupplierController.updateMyProfile,
);
router.put(
  "/me/categories",
  requireAuth,
  requireRoles("SUPPLIER"),
  validateBody(setSupplierCategoriesSchema),
  SupplierController.setMyCategories,
);
router.get("/:supplierId", SupplierController.getVerifiedById);

export const SupplierRoutes = router;

const adminRouter = Router();
adminRouter.use(requireAuth, requireRoles("ADMIN"));
adminRouter.get("/", SupplierController.listForAdmin);
adminRouter.patch(
  "/:supplierId/verification",
  validateBody(supplierVerificationSchema),
  SupplierController.updateVerification,
);

export const AdminSupplierRoutes = adminRouter;
