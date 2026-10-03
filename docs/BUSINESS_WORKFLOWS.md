# Business Workflows

## Supplier onboarding

```text
Register SUPPLIER
 → verify email
 → complete legal/business profile
 → select procurement categories
 → ADMIN review
 → VERIFIED / REJECTED
```

Changing verified legal identity fields returns the supplier to `PENDING` verification.

## RFQ

```text
DRAFT → OPEN → EVALUATING → AWARDED
  └──────→ CANCELLED
```

Only draft RFQs are editable. Supplier discovery returns only open, non-expired opportunities.

## Quotation

```text
SUBMITTED → UNDER_REVIEW → AWARDED
                         └→ REJECTED
SUBMITTED → WITHDRAWN
```

Server rules enforce category eligibility, deadline, one quotation per supplier/RFQ, and server-calculated totals.

## Purchase order

```text
ISSUED → ACCEPTED → IN_PROGRESS → PARTIALLY_DELIVERED → DELIVERED
   ├→ REJECTED
   └→ CANCELLED (buyer before acceptance)
```

The supplier does not mark delivery. Buyer goods-receipt records drive delivery progress.

## Goods receipts

Each receipt records received, accepted, and rejected quantity by PO item. Accepted quantity contributes to fulfillment; rejected units may be replaced in later batches.

## Invoice

```text
SUBMITTED → UNDER_REVIEW → APPROVED → PAYMENT_PENDING → PAID
              └──────────→ REJECTED
SUBMITTED → CANCELLED
```

Invoice quantity is receipt-backed: suppliers can invoice only accepted quantities not already reserved by another active invoice.

## Payment

```text
APPROVED Invoice
 → create/reuse Stripe Checkout session
 → PAYMENT_PENDING
 → signed Stripe webhook
 → SUCCEEDED + Invoice PAID
```

Failed/expired Checkout returns the invoice to an appropriate retryable state.

## Refund

```text
REQUESTED → APPROVED → PROCESSING → SUCCEEDED
    ├→ REJECTED
    └→ CANCELLED
                    └→ FAILED
```

Partial and full refunds are supported. Successful cumulative refund amount determines whether the original payment remains `SUCCEEDED` or becomes `REFUNDED`.

## Dispute

```text
OPEN → UNDER_REVIEW → RESOLVED
                  └→ REJECTED
```

Only actual transaction counterparties may open disputes. Admin owns resolution.
