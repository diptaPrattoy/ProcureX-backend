# Data Model and Invariants

## Roles

- `BUYER`
- `SUPPLIER`
- `ADMIN`

## Entity map

```text
User
 ├─ BuyerProfile
 ├─ SupplierProfile ─ SupplierCategory ─ Category
 ├─ RefreshToken
 └─ AuthToken

BuyerProfile/User
     ↓
    Rfq ─ RfqItem
     ↓
 Quotation ─ QuotationItem
     ↓
PurchaseOrder ─ PurchaseOrderItem
     ↓
GoodsReceipt ─ GoodsReceiptItem
     ↓
  Invoice ─ InvoiceItem
     ↓
  Payment ─ Refund

Cross-cutting:
WebhookEvent
Dispute
AuditLog
Notification
```

## Core invariants

1. Only verified, active suppliers may participate in quotation workflows.
2. One supplier has at most one quotation record per RFQ.
3. One RFQ can issue at most one purchase order.
4. PO/PO-item data is a commercial snapshot created at award time.
5. Received accepted quantity cannot exceed the outstanding ordered quantity.
6. Rejected receipt quantity does not consume fulfilled quantity.
7. Invoiced quantities cannot exceed accepted, not-already-reserved quantities.
8. Payment amount/currency are taken from the approved invoice.
9. Payment initiation and Stripe webhook processing use independent idempotency boundaries.
10. Refund totals cannot exceed the original successful payment.
11. Audit and financial records are retained rather than soft-deleted.

## Precision

Money is stored as PostgreSQL `DECIMAL(14,2)` and quantities as `DECIMAL(14,3)`. Authoritative totals are calculated using decimal-safe values rather than trusting client totals.

## Soft deletes

`deletedAt` is used on selected user-facing/master/workflow entities such as User, SupplierProfile, Category, Rfq, and Quotation. Financial/legal records such as PO, receipts, invoices, payments, refunds, and audit logs remain durable.

## Indexing

The schema includes indexes for common operational queries, including:

- user role/status and creation time;
- supplier verification/location;
- RFQ buyer/category/status/deadline;
- quotation RFQ/supplier/status;
- PO buyer/supplier/status;
- invoice buyer/supplier/status/due date;
- payment/refund state;
- dispute ownership/state;
- audit actor/entity/action/time;
- notification unread/time access.

## Idempotency

- `Payment.idempotencyKey` protects payment initiation.
- `Payment.providerPaymentIntentId` and Checkout session IDs are unique.
- `Refund.idempotencyKey` protects refund creation.
- `WebhookEvent.providerEventId` deduplicates Stripe webhook deliveries.
