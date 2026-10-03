# ProcuraX

**ProcuraX** is a backend-first B2B procurement and vendor management platform designed to manage the complete procurement lifecycle — from supplier onboarding and RFQ creation to quotation evaluation, purchase orders, goods receiving, invoicing, payments, refunds, and dispute resolution.

The platform is built with a modular TypeScript architecture using Express.js, Prisma ORM, PostgreSQL, Redis, and Stripe. It focuses on transactional integrity, role-based access control, auditability, secure payment processing, and scalable API design.

---

## Overview

ProcuraX provides a structured procurement workflow for organizations and suppliers.

The platform supports three primary roles:

- **Buyer** — Creates RFQs, evaluates supplier quotations, issues purchase orders, records received goods, reviews invoices, and manages payments.
- **Supplier** — Maintains a supplier profile, responds to procurement opportunities, fulfills purchase orders, and submits invoices.
- **Admin** — Verifies suppliers, monitors platform activity, manages disputes and refunds, and accesses platform-wide analytics and audit logs.

---

## Core Procurement Workflow

```text
Supplier Registration
        ↓
Supplier Verification
        ↓
Buyer Creates RFQ
        ↓
RFQ Published
        ↓
Suppliers Submit Quotations
        ↓
Buyer Evaluates Quotations
        ↓
Quotation Awarded
        ↓
Purchase Order Issued
        ↓
Supplier Accepts PO
        ↓
Goods Delivered
        ↓
Buyer Records Goods Receipt
        ↓
Supplier Submits Invoice
        ↓
Buyer Reviews & Approves Invoice
        ↓
Stripe Payment
        ↓
Payment Reconciliation
```

The platform also supports refund and dispute workflows for completed financial transactions.

---

## Features

### Authentication & Account Security

- Email and password authentication
- Google authentication
- JWT Bearer access tokens
- Rotating refresh tokens
- Refresh-token revocation
- Secure password hashing
- Email verification
- Forgot/reset password workflow
- Account suspension support
- Role-based authorization
- Authentication-specific rate limiting

---

### Supplier Management

- Supplier profile management
- Procurement category specialization
- Business registration and tax information
- Admin-controlled supplier verification
- Verification lifecycle tracking
- Public verified supplier directory
- Supplier search, filtering, sorting, and pagination

Only verified suppliers are eligible to participate in procurement opportunities.

---

### RFQ Management

Buyers can create and manage Requests for Quotation containing multiple procurement items.

Supported capabilities include:

- Draft RFQs
- Multi-item procurement requests
- Category assignment
- Budget ranges
- Submission deadlines
- Delivery dates
- Shipping information
- Draft editing
- RFQ publishing
- RFQ cancellation
- Soft deletion
- Search and filtering
- Pagination and sorting

Published RFQs become immutable to protect the integrity of supplier quotations.

---

### Supplier Quotations

Verified suppliers can submit quotations against eligible RFQs.

Quotation validation includes:

- Supplier verification
- Procurement-category matching
- RFQ deadline validation
- One quotation per supplier per RFQ
- RFQ item matching
- Server-calculated line totals
- Server-calculated subtotal and total
- Currency consistency
- Ownership checks
- Controlled quotation lifecycle

Quotation values are calculated on the server instead of trusting financial totals from the client.

---

## Quotation Evaluation & Award

Buyers can move an RFQ into evaluation and compare supplier quotations.

Awarding a quotation is performed through an atomic Prisma transaction.

```text
Winning Quotation → AWARDED

Other Quotations → REJECTED

RFQ → AWARDED

Purchase Order → CREATED

Audit Events → CREATED
```

If any step fails, the entire transaction rolls back.

This prevents partially completed procurement awards.

---

## Purchase Orders

Awarding a quotation automatically generates a purchase order containing immutable snapshots of the awarded procurement data.

Purchase order lifecycle:

```text
ISSUED
   ↓
ACCEPTED
   ↓
IN_PROGRESS
   ↓
PARTIALLY_DELIVERED
   ↓
DELIVERED
```

Alternative states include:

```text
ISSUED → REJECTED
ISSUED → CANCELLED
```

The purchase order preserves quantities, negotiated prices, item details, supplier details, and commercial totals from the winning quotation.

---

## Goods Receiving

Goods receipts are controlled by the buyer rather than the supplier.

ProcuraX supports:

- Multiple delivery batches
- Partial deliveries
- Accepted quantities
- Rejected quantities
- Remaining quantity calculations
- Over-receipt prevention
- Transaction-safe receiving
- Automatic purchase-order status updates

Rejected quantities do not consume the purchased quantity, allowing suppliers to replace rejected units in future deliveries.

---

## Invoicing

Suppliers can create invoices based on quantities already accepted through goods receipts.

This creates a receipt-backed invoicing model:

```text
Purchase Order
      ↓
Goods Receipt
      ↓
Accepted Quantity
      ↓
Supplier Invoice
```

Supported capabilities include:

- Multiple invoices per purchase order
- Partial invoicing
- Invoice number uniqueness
- Server-calculated financial totals
- Invoice due dates
- Over-invoicing prevention
- Invoice cancellation
- Buyer invoice review
- Approval and rejection workflows

Invoice lifecycle:

```text
SUBMITTED
    ↓
UNDER_REVIEW
   /          \
APPROVED     REJECTED
```

Only approved invoices are eligible for payment.

---

## Stripe Payments

ProcuraX integrates Stripe Checkout for invoice payments.

Payment flow:

```text
APPROVED Invoice
       ↓
Payment Initiation
       ↓
Stripe Checkout
       ↓
Stripe Webhook
       ↓
Payment Reconciliation
       ↓
Invoice PAID
```

Payment security includes:

- Server-controlled payment amounts
- Stripe Checkout sessions
- PaymentIntent tracking
- Idempotency keys
- Checkout session reuse
- Secure webhook signature verification
- Raw webhook body preservation
- Webhook event deduplication
- Database-backed payment state
- Failed payment recovery

Stripe webhooks are processed independently of application-level rate limiting to avoid blocking legitimate provider events.

---

## Refunds

ProcuraX supports both full and partial Stripe refunds.

Refund workflow:

```text
Buyer Requests Refund
        ↓
REQUESTED
        ↓
Admin Review
   /           \
REJECTED     APPROVED
                 ↓
            Stripe Refund
                 ↓
        SUCCEEDED / FAILED
```

The platform prevents the cumulative refund amount from exceeding the original payment.

Refund state is reconciled with Stripe through webhook events.

---

## Dispute Management

Buyers and suppliers can open disputes related to purchase orders or invoices in which they are participants.

Dispute lifecycle:

```text
OPEN
  ↓
UNDER_REVIEW
  ↓
RESOLVED
```

or:

```text
UNDER_REVIEW → REJECTED
```

Administrators manage dispute review and resolution while maintaining a complete audit trail.

---

## Notifications

ProcuraX contains a database-backed notification system used throughout procurement workflows.

Notifications may be generated for events such as:

- RFQ activity
- Quotation awards
- Purchase-order changes
- Goods receipts
- Invoice submissions
- Invoice approvals or rejections
- Payments
- Refunds
- Disputes

Users can:

- View notifications
- Filter read/unread notifications
- View unread counts
- Mark individual notifications as read
- Mark all notifications as read

---

## Audit Logging

Critical platform operations generate audit records.

Examples include:

```text
RFQ_CREATED
RFQ_PUBLISHED
QUOTATION_SUBMITTED
QUOTATION_AWARDED
PURCHASE_ORDER_ACCEPTED
GOODS_RECEIPT_CREATED
INVOICE_SUBMITTED
INVOICE_APPROVED
PAYMENT_COMPLETED
REFUND_REQUESTED
DISPUTE_OPENED
```

Audit records can contain:

- Actor
- Action
- Entity type
- Entity ID
- Metadata
- IP address
- Timestamp

Users can access their own activity history, while administrators can inspect platform-wide audit records.

---

## Analytics

The admin dashboard exposes procurement and operational analytics.

Available metrics include:

- User counts
- Role distribution
- Supplier verification statistics
- RFQ activity
- Quotation activity
- Purchase orders
- Invoice statistics
- Payment statistics
- Refund requests
- Disputes
- Outstanding workflows
- Recent activity
- Daily operational trends

Financial metrics are grouped by currency to avoid combining unrelated currencies into misleading totals.

Example:

```text
USD
grossCollected
refunded
netCashFlow
outstandingApproved

BDT
grossCollected
refunded
netCashFlow
outstandingApproved
```

---

## Caching & Performance

ProcuraX uses Upstash Redis for serverless-friendly caching.

Cached resources include:

- Procurement categories
- Public supplier directory
- Admin analytics

The caching layer is fail-open:

```text
Redis Available
      ↓
Serve Cached Data

Redis Unavailable
      ↓
Query PostgreSQL
      ↓
API Remains Available
```

Supplier-directory cache invalidation uses versioned namespaces instead of expensive Redis wildcard scans.

---

## Rate Limiting

Rate limiting can use Upstash Redis for distributed state.

This makes rate limits consistent across multiple Vercel serverless instances.

Separate limits are used for:

- General API traffic
- Authentication endpoints

---

## Security

ProcuraX includes multiple application-level security controls:

- Helmet security headers
- Configurable CORS
- JWT authentication
- Refresh-token rotation
- Password hashing
- Zod request validation
- Role-based authorization
- Resource ownership checks
- Rate limiting
- Stripe webhook verification
- Payment idempotency
- Soft deletion
- Audit logging
- Environment validation
- Database transactions
- Server-calculated financial values

---

## Technology Stack

### Runtime & API

- Node.js 22
- Express.js
- TypeScript
- REST API

### Database

- PostgreSQL
- Neon
- Prisma ORM

### Authentication

- JWT
- Google Identity Services
- bcrypt

### Payments

- Stripe Checkout
- Stripe Webhooks
- Stripe Refunds

### Validation

- Zod

### Cache & Rate Limiting

- Upstash Redis
- Upstash Rate Limit

### Security

- Helmet
- CORS

### Tooling

- Prisma CLI
- tsup
- TypeScript
- Postman

### Deployment

- Vercel
- Neon PostgreSQL
- Upstash Redis

---

## Architecture

ProcuraX follows a modular backend structure.

```text
src/
├── app/
│   ├── config/
│   ├── errors/
│   ├── middlewares/
│   ├── modules/
│   │   ├── admin/
│   │   ├── analytics/
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── buyer/
│   │   ├── category/
│   │   ├── dispute/
│   │   ├── goods-receipt/
│   │   ├── invoice/
│   │   ├── notification/
│   │   ├── payment/
│   │   ├── purchase-order/
│   │   ├── quotation/
│   │   ├── refund/
│   │   ├── rfq/
│   │   └── supplier/
│   ├── routes/
│   └── utils/
├── generated/
├── lib/
├── app.ts
└── server.ts

prisma/
├── migrations/
├── schema.prisma
└── seed.ts
```

Individual domain modules follow a layered structure such as:

```text
module/
├── module.controller.ts
├── module.route.ts
├── module.service.ts
└── module.validation.ts
```

---

## API Versioning

All application APIs are exposed under:

```text
/api/v1
```

Examples:

```http
POST /api/v1/auth/login

GET /api/v1/rfqs/open

POST /api/v1/rfqs/:rfqId/quotations

GET /api/v1/purchase-orders

POST /api/v1/invoices/:invoiceId/pay

GET /api/v1/notifications

GET /api/v1/admin/dashboard/overview
```

---

## API Documentation

A complete Postman collection is available at:

```text
postman/ProcuraX.postman_collection.json
```

The collection covers authentication and the complete procurement workflow for Buyer, Supplier, and Admin roles.

Additional technical documentation is available in the [`docs`](./docs) directory.

---

## Getting Started

### Prerequisites

Install:

- Node.js 22+
- npm
- PostgreSQL-compatible database or Neon account
- Stripe account
- Google OAuth credentials

Redis and SMTP services are optional during local development.

---

### Clone the Repository

```bash
git clone <repository-url>
cd procurax-backend
```

---

### Install Dependencies

```bash
npm install
```

---

### Environment Configuration

Create:

```text
.env
```

using:

```text
.env.example
```

as the reference.

Important configuration groups include:

```env
DATABASE_URL=
DIRECT_URL=

JWT_ACCESS_SECRET=

GOOGLE_CLIENT_ID=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Never commit production secrets or `.env` files to source control.

---

## Database Setup

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply migrations:

```bash
npm run db:deploy
```

Seed reference data:

```bash
npm run db:seed
```

---

## Development

Start the development server:

```bash
npm run dev
```

The API runs locally at:

```text
http://localhost:5000
```

Health endpoint:

```http
GET /api/v1/health
```

---

## Validation & Build

Run the complete verification pipeline:

```bash
npm run verify
```

The verification process validates the Prisma schema and performs:

```text
Prisma validation
      ↓
TypeScript type checking
      ↓
Automated tests
      ↓
Production build
```

Individual commands are also available:

```bash
npm run typecheck
npm run test
npm run build
```

---

## Database Management

Generate Prisma Client:

```bash
npm run prisma:generate
```

Open Prisma Studio:

```bash
npm run db:studio
```

Run migrations during development:

```bash
npm run db:migrate
```

Deploy committed migrations:

```bash
npm run db:deploy
```

Seed the database:

```bash
npm run db:seed
```

---

## Stripe Webhooks

For local Stripe webhook testing, Stripe CLI can forward webhook events to the backend:

```bash
stripe listen --forward-to localhost:5000/api/v1/payments/webhooks/stripe
```

Use the generated webhook signing secret as:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

For production, configure the deployed HTTPS webhook endpoint in Stripe.

---

## Production Deployment

ProcuraX is designed to run in serverless environments such as Vercel.

The production architecture can use:

```text
Vercel
  │
  ├── Express API
  │
  ├── Stripe Webhooks
  │
  └── Prisma
          │
          ▼
   Neon PostgreSQL

Vercel
  │
  ▼
Upstash Redis
```

Application state is stored in PostgreSQL, Redis, and Stripe rather than process memory, allowing requests to execute safely across separate serverless instances.

Production secrets should be configured through the deployment platform's environment-variable management system.

---

## Documentation

Additional documentation is available under:

```text
docs/
```

covering architecture, authentication, data modeling, RFQs, quotation workflows, purchase orders, supplier management, evaluation logic, deployment, and API usage.

---

## License

Dipta Prattoy Karmakar
