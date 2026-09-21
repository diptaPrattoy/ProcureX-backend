import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { BuyerRoutes } from "../modules/buyer/buyer.route.js";
import { CategoryRoutes } from "../modules/category/category.route.js";
import { HealthRoutes } from "../modules/health/health.route.js";
import { GoodsReceiptRoutes, PurchaseOrderGoodsReceiptRoutes } from "../modules/goods-receipt/goods-receipt.route.js";
import { QuotationRfqRoutes, QuotationRoutes } from "../modules/quotation/quotation.route.js";
import { PurchaseOrderRoutes } from "../modules/purchase-order/purchase-order.route.js";
import { RfqRoutes } from "../modules/rfq/rfq.route.js";
import { AdminSupplierRoutes, SupplierRoutes } from "../modules/supplier/supplier.route.js";

const router = Router();

router.use("/health", HealthRoutes);
router.use("/auth", AuthRoutes);
router.use("/categories", CategoryRoutes);
router.use("/rfqs", QuotationRfqRoutes);
router.use("/rfqs", RfqRoutes);
router.use("/quotations", QuotationRoutes);
router.use("/purchase-orders", PurchaseOrderGoodsReceiptRoutes);
router.use("/purchase-orders", PurchaseOrderRoutes);
router.use("/goods-receipts", GoodsReceiptRoutes);
router.use("/buyers", BuyerRoutes);
router.use("/suppliers", SupplierRoutes);
router.use("/admin/suppliers", AdminSupplierRoutes);

export const apiRouter = router;
