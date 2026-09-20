# ProcuraX Backend

ProcuraX is a modular B2B procurement backend built with Express, TypeScript, Prisma and PostgreSQL. It models the source-to-pay workflow from buyer RFQs through supplier quotations, purchase orders, receiving, invoicing and Stripe payments.

## Current implementation

- Express 5 + TypeScript modular architecture
- Prisma 7 + PostgreSQL/Neon
- BUYER, SUPPLIER and ADMIN RBAC
- Email/password authentication, Google sign-in, access/refresh sessions
- Email verification and password recovery
- Buyer and supplier business profiles
- Supplier category assignment and ADMIN verification
- Public verified-supplier discovery
- Buyer RFQ draft lifecycle with line items
- RFQ search/filter/sort/pagination
- Supplier discovery of active procurement opportunities
- Audit logging and soft deletion
- Helmet, CORS and rate limiting

## RFQ lifecycle

`DRAFT -> OPEN -> EVALUATING -> AWARDED -> CLOSED`

Commit 06 implements `DRAFT -> OPEN`, buyer ownership, cancellation, soft deletion and supplier opportunity discovery. Quotation submission and award processing are added in later commits.

## Local development

```bash
npm install
npm run prisma:generate
npm run typecheck
npm run check
npm run dev
```

API base URL: `http://localhost:5000/api/v1`

Detailed development notes and the Postman collection are kept locally during implementation (`docs/` and `postman/` are gitignored) and will be polished and committed near project completion.
