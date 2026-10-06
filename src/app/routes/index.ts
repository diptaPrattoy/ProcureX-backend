import { Router } from "express";
import {
  ActivityRoutes,
  AdminAuditRoutes,
} from "../modules/activity/activity.route.js";
import { AdminDashboardRoutes } from "../modules/admin-dashboard/admin-dashboard.route.js";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { BuyerRoutes } from "../modules/buyer/buyer.route.js";
import { CategoryRoutes } from "../modules/category/category.route.js";
import {
  AdminDisputeRoutes,
  DisputeRoutes,
  InvoiceDisputeRoutes,
  PurchaseOrderDisputeRoutes,
} from "../modules/dispute/dispute.route.js";
import {
  GoodsReceiptRoutes,
  PurchaseOrderGoodsReceiptRoutes,
} from "../modules/goods-receipt/goods-receipt.route.js";
import { HealthRoutes } from "../modules/health/health.route.js";
import {
  InvoiceRoutes,
  PurchaseOrderInvoiceRoutes,
} from "../modules/invoice/invoice.route.js";
import { NotificationRoutes } from "../modules/notification/notification.route.js";
import {
  InvoicePaymentRoutes,
  PaymentRoutes,
} from "../modules/payment/payment.route.js";
import { PurchaseOrderRoutes } from "../modules/purchase-order/purchase-order.route.js";
import {
  QuotationRfqRoutes,
  QuotationRoutes,
} from "../modules/quotation/quotation.route.js";
import {
  AdminRefundRoutes,
  PaymentRefundRoutes,
  RefundRoutes,
} from "../modules/refund/refund.route.js";
import { RfqRoutes } from "../modules/rfq/rfq.route.js";
import {
  AdminSupplierRoutes,
  SupplierRoutes,
} from "../modules/supplier/supplier.route.js";

const router = Router();

router.use("/health", HealthRoutes);
router.use("/auth", AuthRoutes);
router.use("/notifications", NotificationRoutes);
router.use("/activity", ActivityRoutes);
router.use("/categories", CategoryRoutes);
router.use("/rfqs", QuotationRfqRoutes);
router.use("/rfqs", RfqRoutes);
router.use("/quotations", QuotationRoutes);
router.use("/purchase-orders", PurchaseOrderDisputeRoutes);
router.use("/purchase-orders", PurchaseOrderGoodsReceiptRoutes);
router.use("/purchase-orders", PurchaseOrderInvoiceRoutes);
router.use("/purchase-orders", PurchaseOrderRoutes);
router.use("/goods-receipts", GoodsReceiptRoutes);
router.use("/invoices", InvoiceDisputeRoutes);
router.use("/invoices", InvoicePaymentRoutes);
router.use("/invoices", InvoiceRoutes);
router.use("/payments", PaymentRefundRoutes);
router.use("/payments", PaymentRoutes);
router.use("/refunds", RefundRoutes);
router.use("/disputes", DisputeRoutes);
router.use("/admin/disputes", AdminDisputeRoutes);
router.use("/admin/dashboard", AdminDashboardRoutes);
router.use("/admin/audit-logs", AdminAuditRoutes);
router.use("/admin/refunds", AdminRefundRoutes);
router.use("/buyers", BuyerRoutes);
router.use("/suppliers", SupplierRoutes);
router.use("/admin/suppliers", AdminSupplierRoutes);

export const apiRouter = router;
