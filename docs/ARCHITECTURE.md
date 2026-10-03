# ProcuraX Architecture

## System shape

ProcuraX is a modular Express/TypeScript backend built around domain modules and service-layer business rules.

```text
Client / Postman / Future Frontend
              ↓
        Express Routes
              ↓
     Auth + RBAC + Zod
              ↓
         Controllers
              ↓
           Services
       ↙      ↓       ↘
   Prisma   Stripe    Redis
      ↓                 ↓
 Neon PostgreSQL     Upstash
```

The Stripe webhook is a special ingress path. It is mounted before `express.json()` so signature verification receives the unmodified raw request payload.

## Domain modules

- `auth` — password/Google authentication, access/refresh sessions, email verification, password reset
- `buyer` — buyer profile
- `supplier` — supplier profile, categories, public directory, admin verification
- `rfq` — buyer RFQ lifecycle and supplier opportunity discovery
- `quotation` — supplier quotation lifecycle and buyer evaluation/award
- `purchase-order` — supplier acceptance/rejection and fulfillment start
- `goods-receipt` — buyer-controlled receiving and partial delivery
- `invoice` — receipt-backed invoicing and buyer review
- `payment` — Stripe Checkout and webhook reconciliation
- `refund` — buyer refund requests and admin/Stripe reconciliation
- `dispute` — buyer/supplier disputes and admin resolution
- `notification` — notification center
- `activity` — personal activity and admin audit history
- `admin-dashboard` — operational and financial analytics
- `category` — procurement reference data
- `health` — database/cache readiness metadata

## Request lifecycle

```text
Route
  → requireAuth / requireRoles
  → validateBody (where applicable)
  → controller
  → service
  → Prisma/Stripe/Redis
  → sendResponse
```

Errors are normalized by the global error handler.

## Persistence strategy

PostgreSQL is the source of truth. Redis contains only reconstructable cache/rate-limit state. Financial and workflow state is never stored only in memory or Redis.

Runtime database traffic uses the Neon pooled connection. Prisma migrations use the direct Neon connection.

## Serverless design

- no required in-process session state;
- refresh/payment/refund/webhook state is database-backed;
- Upstash provides shared distributed rate-limit/cache state;
- Prisma connects lazily;
- short transactions protect only operations that require atomicity;
- Stripe retries are safe because provider/event idempotency is persisted.

## Core transaction boundaries

### Quotation award

Atomically:

1. validate RFQ and quotation;
2. award selected quotation;
3. reject competing active quotations;
4. set RFQ to awarded;
5. create immutable PO snapshot/items;
6. create audit records.

### Goods receipt

Validates cumulative accepted quantity and applies receipt/PO status changes atomically, preventing concurrent over-receiving.

### Payment webhook

Deduplicates Stripe event ID, reconciles Payment/Invoice state, and records audit/notification state in a safe database transaction.

### Refund

Reserves refundable balance, uses Stripe idempotency, then reconciles partial/full refund state through Stripe webhooks.
