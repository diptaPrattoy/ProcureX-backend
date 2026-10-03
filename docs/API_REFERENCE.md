# ProcuraX API Reference

Base prefix: `/api/v1`

Authentication for protected routes:

```http
Authorization: Bearer <access-token>
```

This file is a grouped reference. The submission-ready executable documentation is `postman/ProcuraX.postman_collection.json`.

## Health and reference

| Method | Path | Access |
|---|---|---|
| GET | `/health` | Public |
| GET | `/categories` | Public |
| GET | `/suppliers` | Public |
| GET | `/suppliers/:supplierId` | Public |

## Authentication

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register/buyer` | Public |
| POST | `/auth/register/supplier` | Public |
| POST | `/auth/login` | Public |
| POST | `/auth/google` | Public |
| POST | `/auth/refresh` | Public/refresh token |
| POST | `/auth/logout` | Public/refresh token |
| POST | `/auth/email/resend-verification` | Public |
| POST | `/auth/email/verify` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| GET | `/auth/me` | Authenticated |

## Profiles and supplier onboarding

| Method | Path | Access |
|---|---|---|
| GET | `/buyers/me/profile` | BUYER |
| PATCH | `/buyers/me/profile` | BUYER |
| GET | `/suppliers/me/profile` | SUPPLIER |
| PATCH | `/suppliers/me/profile` | SUPPLIER |
| PUT | `/suppliers/me/categories` | SUPPLIER |
| GET | `/admin/suppliers` | ADMIN |
| PATCH | `/admin/suppliers/:supplierId/verification` | ADMIN |

## RFQs

| Method | Path | Access |
|---|---|---|
| POST | `/rfqs` | BUYER |
| GET | `/rfqs/mine` | BUYER |
| GET | `/rfqs/mine/:rfqId` | BUYER |
| PATCH | `/rfqs/:rfqId` | BUYER |
| POST | `/rfqs/:rfqId/publish` | BUYER |
| POST | `/rfqs/:rfqId/cancel` | BUYER |
| DELETE | `/rfqs/:rfqId` | BUYER, soft delete |
| GET | `/rfqs/open` | SUPPLIER |
| GET | `/rfqs/open/:rfqId` | SUPPLIER |

## Quotations and evaluation

| Method | Path | Access |
|---|---|---|
| POST | `/rfqs/:rfqId/quotations` | SUPPLIER |
| GET | `/quotations/mine` | SUPPLIER |
| GET | `/quotations/mine/:quotationId` | SUPPLIER |
| PATCH | `/quotations/:quotationId` | SUPPLIER |
| POST | `/quotations/:quotationId/withdraw` | SUPPLIER |
| GET | `/rfqs/:rfqId/quotations` | BUYER |
| GET | `/rfqs/:rfqId/quotations/:quotationId` | BUYER |
| POST | `/rfqs/:rfqId/evaluation/start` | BUYER |
| POST | `/rfqs/:rfqId/quotations/:quotationId/award` | BUYER |

## Purchase orders and receiving

| Method | Path | Access |
|---|---|---|
| GET | `/purchase-orders` | BUYER / SUPPLIER |
| GET | `/purchase-orders/:purchaseOrderId` | BUYER / SUPPLIER |
| POST | `/purchase-orders/:purchaseOrderId/accept` | SUPPLIER |
| POST | `/purchase-orders/:purchaseOrderId/reject` | SUPPLIER |
| POST | `/purchase-orders/:purchaseOrderId/start-fulfillment` | SUPPLIER |
| POST | `/purchase-orders/:purchaseOrderId/cancel` | BUYER |
| POST | `/purchase-orders/:purchaseOrderId/goods-receipts` | BUYER |
| GET | `/purchase-orders/:purchaseOrderId/goods-receipts` | BUYER / SUPPLIER |
| GET | `/goods-receipts/:goodsReceiptId` | BUYER / SUPPLIER |

## Invoices

| Method | Path | Access |
|---|---|---|
| POST | `/purchase-orders/:purchaseOrderId/invoices` | SUPPLIER |
| GET | `/purchase-orders/:purchaseOrderId/invoices` | BUYER / SUPPLIER |
| GET | `/invoices` | BUYER / SUPPLIER |
| GET | `/invoices/:invoiceId` | BUYER / SUPPLIER |
| POST | `/invoices/:invoiceId/start-review` | BUYER |
| POST | `/invoices/:invoiceId/approve` | BUYER |
| POST | `/invoices/:invoiceId/reject` | BUYER |
| POST | `/invoices/:invoiceId/cancel` | SUPPLIER |

## Payments

| Method | Path | Access |
|---|---|---|
| POST | `/invoices/:invoiceId/payments/checkout` | BUYER |
| GET | `/payments` | BUYER |
| GET | `/payments/:paymentId` | BUYER |
| POST | `/payments/webhooks/stripe` | Stripe signed webhook |

## Refunds

| Method | Path | Access |
|---|---|---|
| POST | `/payments/:paymentId/refunds` | BUYER |
| GET | `/refunds` | BUYER |
| GET | `/refunds/:refundId` | BUYER |
| POST | `/refunds/:refundId/cancel` | BUYER |
| GET | `/admin/refunds` | ADMIN |
| GET | `/admin/refunds/:refundId` | ADMIN |
| POST | `/admin/refunds/:refundId/approve` | ADMIN |
| POST | `/admin/refunds/:refundId/reject` | ADMIN |
| POST | `/admin/refunds/:refundId/retry` | ADMIN |

## Disputes

| Method | Path | Access |
|---|---|---|
| POST | `/purchase-orders/:purchaseOrderId/disputes` | BUYER / SUPPLIER |
| POST | `/invoices/:invoiceId/disputes` | BUYER / SUPPLIER |
| GET | `/disputes` | BUYER / SUPPLIER |
| GET | `/disputes/:disputeId` | BUYER / SUPPLIER |
| GET | `/admin/disputes` | ADMIN |
| GET | `/admin/disputes/:disputeId` | ADMIN |
| POST | `/admin/disputes/:disputeId/review` | ADMIN |
| POST | `/admin/disputes/:disputeId/resolve` | ADMIN |
| POST | `/admin/disputes/:disputeId/reject` | ADMIN |

## Notifications and activity

| Method | Path | Access |
|---|---|---|
| GET | `/notifications` | Authenticated |
| GET | `/notifications/unread-count` | Authenticated |
| PATCH | `/notifications/read-all` | Authenticated |
| PATCH | `/notifications/:notificationId/read` | Authenticated |
| GET | `/activity/me` | Authenticated |
| GET | `/admin/audit-logs` | ADMIN |
| GET | `/admin/audit-logs/:auditLogId` | ADMIN |

## Admin analytics

| Method | Path | Access |
|---|---|---|
| GET | `/admin/dashboard/overview` | ADMIN |
| GET | `/admin/dashboard/financials` | ADMIN |
| GET | `/admin/dashboard/trends` | ADMIN |

## Search / filters / pagination

List endpoints expose domain-relevant combinations of `page`, `limit`, `search`, status filters, date filters, sorting, location, category, or role-specific filters. See the Postman request examples for supported query parameters per endpoint.
