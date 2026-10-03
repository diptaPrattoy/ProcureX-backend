# ProcuraX — B2B Procurement & Vendor Management Backend

ProcuraX is a production-oriented REST API for business procurement workflows. It connects buyers, verified suppliers, and platform administrators through a complete procure-to-pay lifecycle: RFQ creation, competitive quotations, transactional award, purchase orders, goods receiving, invoicing, Stripe payments, refunds, disputes, notifications, audit history, analytics, caching, and rate limiting.

This repository contains the **backend only**. It is designed for API-first evaluation with Postman and for a separate frontend to be added later.

## Submission Snapshot

| Item | Value |
|---|---|
| Project Name | ProcuraX — B2B Procurement & Vendor Management Platform |
| Backend Repository | `<YOUR_BACKEND_REPOSITORY_URL>` |
| Live API | `<YOUR_VERCEL_API_URL>` |
| Postman Documentation | `<YOUR_PUBLISHED_POSTMAN_DOCS_URL>` |
| Demo Video | `<YOUR_5_TO_10_MINUTE_VIDEO_URL>` |
| Demo Admin Email | `admin@procurax.local` |
| Demo Admin Password | `AdminPass123!` |

> The admin credentials above are **evaluation/demo credentials only**. Seed them only in the assignment/demo environment and rotate or disable them afterward.

## Why ProcuraX

ProcuraX is not a generic CRUD project. Its main challenge is preserving business and financial consistency across a multi-step procurement lifecycle where three different roles act on the same commercial transaction at different stages.

A typical flow is:

```text
BUYER creates RFQ
      ↓
SUPPLIERS submit quotations
      ↓
BUYER starts evaluation
      ↓
One quotation is awarded atomically
      ↓
Purchase Order is issued
      ↓
SUPPLIER accepts and fulfills
      ↓
BUYER records accepted/rejected goods
      ↓
SUPPLIER invoices accepted quantities
      ↓
BUYER reviews and approves invoice
      ↓
Stripe Checkout payment
      ↓
Webhook reconciliation
      ↓
Refund / dispute workflows when necessary
```

## Primary Roles

ProcuraX has exactly three primary application roles:

| Role | Main Responsibilities |
|---|---|
| `BUYER` | Create and publish RFQs, evaluate quotations, own purchase orders, record goods receipts, review invoices, pay invoices, request refunds, open disputes |
| `SUPPLIER` | Maintain supplier profile/categories, submit quotations, accept/fulfill purchase orders, submit invoices, open disputes |
| `ADMIN` | Verify suppliers, review refunds/disputes, inspect audit history, monitor platform analytics |

Role authorization is enforced through Bearer JWT middleware on protected routes.

## Core Features

- Email/password registration and login
- Google Identity Services sign-in
- Short-lived JWT access tokens
- Hashed, rotating refresh tokens with revocation
- Email verification and password reset
- Supplier onboarding and administrator verification
- Public verified-supplier directory
- RFQ draft/publish/cancel/soft-delete workflow
- Search, filters, sorting, and pagination
- Supplier quotation submission with server-calculated totals
- Transactional quotation award and automatic PO creation
- Purchase-order acceptance and fulfillment workflow
- Partial goods receiving with accepted/rejected quantities
- Receipt-backed supplier invoicing
- Buyer invoice review/approval/rejection
- Stripe Checkout payment integration
- Signed Stripe webhook processing and event idempotency
- Partial/full Stripe refunds and reconciliation
- Purchase-order and invoice dispute resolution
- Notification center and unread tracking
- User activity history and administrator audit logs
- Admin operational/financial/trend analytics
- Redis caching for read-heavy endpoints
- Distributed Redis-backed rate limiting for production/serverless deployment
- PostgreSQL indexes, constraints, soft deletes, and Prisma transactions
- Domain-level automated tests
- Vercel/serverless production configuration

## Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 22 |
| Language | TypeScript |
| API Framework | Express 5 |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Validation | Zod |
| Authentication | Custom JWT + Google Identity Services |
| Password Hashing | bcryptjs |
| Payments | Stripe Checkout + Webhooks + Refunds |
| Cache / Distributed Rate Limit | Upstash Redis |
| Security | Helmet, CORS, rate limiting, strict env validation |
| Email | Nodemailer / SMTP, console mailer in development |
| Build | tsup |
| Tests | Node/TypeScript domain tests via tsx |
| Code Quality | Biome configuration |
| Deployment Target | Vercel Node server / serverless environment |
| API Documentation | Postman |

## Architecture

ProcuraX uses a modular service architecture:

```text
HTTP Request
    ↓
Route
    ↓
Authentication / Role Middleware
    ↓
Zod Validation
    ↓
Controller
    ↓
Service / Business Rules
    ↓
Prisma
    ↓
PostgreSQL (Neon)
```

Cross-cutting services include Stripe, Upstash Redis, email delivery, audit logging, notifications, centralized errors, and shared response utilities.

```text
src/
├── app/
│   ├── config/
│   ├── errors/
│   ├── middlewares/
│   ├── modules/
│   │   ├── auth/
│   │   ├── supplier/
│   │   ├── rfq/
│   │   ├── quotation/
│   │   ├── purchase-order/
│   │   ├── goods-receipt/
│   │   ├── invoice/
│   │   ├── payment/
│   │   ├── refund/
│   │   ├── dispute/
│   │   ├── notification/
│   │   ├── activity/
│   │   └── admin-dashboard/
│   ├── routes/
│   └── utils/
├── lib/
├── app.ts
└── server.ts
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the detailed design.

## Important Business Rules

ProcuraX intentionally enforces business transitions instead of exposing arbitrary status-update endpoints.

- Only verified suppliers mapped to the RFQ category may quote.
- Published RFQs cannot be silently edited after suppliers begin responding.
- Quotation quantities come from the RFQ; suppliers provide commercial prices only.
- Awarding a quotation is a single transaction: winner awarded, competitors rejected, RFQ awarded, PO snapshot created, audit records written.
- Suppliers cannot mark their own goods as received.
- Rejected received quantities do not consume ordered quantity and can be replaced later.
- Suppliers can invoice only buyer-accepted quantities.
- Payment amount/currency are always derived from the approved invoice on the server.
- Stripe webhook events are idempotent using provider event IDs.
- Partial refunds reserve refundable balance and cannot exceed the original successful payment.
- Critical state transitions produce audit records and relevant notifications.

## API

Base prefix:

```text
/api/v1
```

The codebase exposes **80+ REST routes** across authentication, profiles, suppliers, RFQs, quotations, purchase orders, receiving, invoices, payments, refunds, disputes, notifications, audit logs, and analytics.

Example endpoints:

```http
POST   /api/v1/auth/register/buyer
POST   /api/v1/auth/register/supplier
POST   /api/v1/auth/login
POST   /api/v1/auth/google
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me

GET    /api/v1/suppliers
PATCH  /api/v1/admin/suppliers/:supplierId/verification

POST   /api/v1/rfqs
POST   /api/v1/rfqs/:rfqId/publish
GET    /api/v1/rfqs/open

POST   /api/v1/rfqs/:rfqId/quotations
POST   /api/v1/rfqs/:rfqId/evaluation/start
POST   /api/v1/rfqs/:rfqId/quotations/:quotationId/award

POST   /api/v1/purchase-orders/:purchaseOrderId/accept
POST   /api/v1/purchase-orders/:purchaseOrderId/goods-receipts
POST   /api/v1/purchase-orders/:purchaseOrderId/invoices

POST   /api/v1/invoices/:invoiceId/approve
POST   /api/v1/invoices/:invoiceId/payments/checkout
POST   /api/v1/payments/webhooks/stripe

POST   /api/v1/payments/:paymentId/refunds
POST   /api/v1/admin/refunds/:refundId/approve

GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/dashboard/overview
GET    /api/v1/admin/dashboard/financials
GET    /api/v1/admin/dashboard/trends
```

For the complete role-by-role reference, see [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) and the Postman collection at [`postman/ProcuraX.postman_collection.json`](postman/ProcuraX.postman_collection.json).

## Response Contract

Success responses follow:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Error responses follow:

```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": []
}
```

Validation, authentication, authorization, not-found, unique-constraint, and business-rule errors are routed through centralized middleware.

## Database Design

The Prisma schema contains the procurement and platform entities required for the complete workflow, including:

```text
User
BuyerProfile
SupplierProfile
SupplierCategory
Category
RefreshToken
AuthToken
Rfq / RfqItem
Quotation / QuotationItem
PurchaseOrder / PurchaseOrderItem
GoodsReceipt / GoodsReceiptItem
Invoice / InvoiceItem
Payment
Refund
WebhookEvent
Dispute
AuditLog
Notification
```

The schema includes unique constraints and indexes for identity, workflow state, ownership, search/filter paths, idempotency keys, webhook IDs, and audit/history access.

Money uses PostgreSQL decimal columns instead of authoritative JavaScript floating-point arithmetic.

See [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

## Transactions and Concurrency

Transactions are used only where atomic consistency is required, including:

- quotation evaluation/award and PO issuance;
- goods receiving and remaining-quantity checks;
- invoice quantity reservation;
- invoice review state changes;
- payment/webhook reconciliation;
- refund balance reservation/reconciliation;
- business state transition + audit/notification writes.

Read-only pagination queries use parallel reads rather than unnecessary transactions, which keeps Neon/serverless behavior efficient.

## Security

- Passwords hashed with bcrypt
- Bearer JWT authentication
- Rotating hashed refresh tokens
- One-time verification/reset token hashes
- Strict 3-role authorization middleware
- Helmet security headers
- Explicit CORS allow-list
- Zod request validation
- Global and auth-specific rate limiting
- Distributed rate limiting with Upstash in production
- Stripe signature verification against the raw request body
- Stripe event and payment/refund idempotency
- Environment validation at startup
- Production-only HTTPS checks
- Soft deletion for selected user-facing records
- Audit logging for critical operations

## Redis / Performance

Upstash Redis is used for:

- procurement-category caching;
- verified-supplier directory caching;
- short-lived admin analytics caching;
- distributed production rate limiting.

Caching is fail-open: if Redis is unavailable, read endpoints fall back to PostgreSQL instead of taking the API offline.

## Local Setup

### 1. Requirements

- Node.js 22
- npm
- Neon PostgreSQL database
- Google OAuth Web Client ID
- Stripe test account
- Upstash Redis database (recommended; optional in local development)
- SMTP credentials for real email delivery (console mode can be used locally)

### 2. Install

```bash
npm install
```

### 3. Environment

Copy:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill the values in `.env`. Never commit `.env`.

### 4. Database

Apply committed migrations:

```bash
npm run db:deploy
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Seed reference categories and the demo admin:

```bash
npm run db:seed
```

### 5. Run locally

```bash
npm run dev
```

Health check:

```text
GET http://localhost:5000/api/v1/health
```

### 6. Verify before pushing/deploying

```bash
npm run verify
```

This runs TypeScript checking, domain tests, Prisma generation, and the production build.

## Environment Variables

The complete template is provided in `.env.example`. Important production values include:

```text
DATABASE_URL
DIRECT_URL
JWT_ACCESS_SECRET
GOOGLE_CLIENT_ID
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST / SMTP_USER / SMTP_PASS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
CORS_ORIGINS
CLIENT_APP_URL
STRIPE_SUCCESS_URL
STRIPE_CANCEL_URL
```

Use the Neon **pooled** connection for `DATABASE_URL` and the non-pooler/direct URL for `DIRECT_URL`.

## Postman

Import:

```text
postman/ProcuraX.postman_collection.json
```

The collection uses a canonical data flow and contains organized requests for all three roles. Collection variables store access tokens and generated entity IDs as the workflow progresses.

Before submission, publish the collection from Postman and place the published documentation URL in the Submission Snapshot above.

See [`docs/POSTMAN.md`](docs/POSTMAN.md).

## Testing

Automated domain tests cover the highest-risk business rules, including:

- quotation calculations and eligibility;
- transactional award behavior;
- purchase-order transitions;
- goods-receipt quantities;
- invoice quantities and review states;
- payments and webhook behavior;
- refunds;
- disputes;
- notifications;
- analytics calculations;
- caching;
- rate-limiting behavior.

Run:

```bash
npm run test
```

or the full verification pipeline:

```bash
npm run verify
```

## Deployment

ProcuraX is prepared for a Vercel Node deployment and Neon/Upstash serverless infrastructure.

Production deployment requires:

1. Vercel project connected to this backend repository.
2. All production environment variables configured.
3. Database migrations deployed against Neon.
4. Demo/reference data seeded if required for evaluation.
5. Stripe webhook endpoint registered as:

```text
https://YOUR_API_DOMAIN/api/v1/payments/webhooks/stripe
```

6. Stripe webhook signing secret added to Vercel.
7. Production CORS and redirect URLs changed to the deployed frontend domain.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the complete sequence.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and module boundaries
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — grouped endpoint reference
- [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) — authentication/session model
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — database model and invariants
- [`docs/BUSINESS_WORKFLOWS.md`](docs/BUSINESS_WORKFLOWS.md) — procurement state machines
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Neon/Vercel/Stripe/Upstash deployment
- [`docs/POSTMAN.md`](docs/POSTMAN.md) — collection workflow and publishing
- [`docs/ASSIGNMENT_COMPLIANCE.md`](docs/ASSIGNMENT_COMPLIANCE.md) — requirement-to-implementation mapping
- [`docs/VIDEO_WALKTHROUGH.md`](docs/VIDEO_WALKTHROUGH.md) — 5–10 minute demo plan
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) — final hand-in checklist

## Final Submission Format

After deployment and video recording, submit using:

```text
Project Name    : ProcuraX — B2B Procurement & Vendor Management Platform
Backend Repo    : <YOUR_BACKEND_REPOSITORY_URL>
Live API        : <YOUR_VERCEL_API_URL>
API Docs        : <YOUR_PUBLISHED_POSTMAN_DOCS_URL>
Demo Video      : <YOUR_5_TO_10_MINUTE_VIDEO_URL>
Admin Email     : admin@procurax.local
Admin Password  : AdminPass123!
```

## License / Academic Use

Built as an academic backend assignment and portfolio project. Do not expose real customer, payment, SMTP, Google, Stripe, Neon, or Redis secrets in the repository.
