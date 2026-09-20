# ProcuraX Backend

ProcuraX is a backend-first B2B procurement platform for managing RFQs, competitive supplier quotations, purchase orders, goods receipts, invoices, disputes and Stripe payments.

## Current scope — Commit 02

The project now has a frozen Prisma/PostgreSQL contract for the procurement lifecycle:

- exactly three primary roles: `BUYER`, `SUPPLIER`, `ADMIN`
- buyer and supplier company profiles
- supplier verification and procurement-category specialization
- RFQs and line items
- competitive quotations and quote line items
- purchase orders and immutable PO line-item snapshots
- partial goods receipts
- multiple invoices per purchase order
- Stripe-ready payment records and persisted webhook-event idempotency
- disputes, notifications and audit logs
- refresh tokens plus email-verification/password-reset token persistence
- deliberate PostgreSQL indexes and soft-delete fields
- idempotent procurement-category seed

The domain invariants that later service modules must obey are documented in `docs/DATA_MODEL.md`.

## Runtime requirements

- Node.js 22 LTS recommended
- Node.js >= 20.19 supported by this project configuration
- PostgreSQL hosted on Neon

## Local setup

Keep the `.env` created in Commit 01. `DATABASE_URL` should be the Neon pooled runtime URL and `DIRECT_URL` the Neon direct URL used by Prisma CLI/migrations.

Install dependencies if needed:

```bash
npm install
```

Format and validate the Prisma schema:

```bash
npm run prisma:format
npm run prisma:validate
```

Create and apply the first migration to your development Neon database:

```bash
npm run db:migrate -- --name init_procurement_core
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Seed the stable procurement categories explicitly (Prisma 7 does not implicitly seed after `migrate dev`):

```bash
npm run db:seed
```

Then verify the application still builds and starts:

```bash
npm run typecheck
npm run check
npm run dev
```

Health check:

```http
GET http://localhost:5000/api/v1/health
```

Expected key field:

```json
{
  "success": true,
  "data": {
    "database": "connected"
  }
}
```

## Verify the seed

Open Prisma Studio:

```bash
npm run db:studio
```

Check the `Category` table. It should contain eight records such as `IT & Electronics`, `Office Supplies`, `Industrial Equipment`, and `Professional Services`.

Running `npm run db:seed` again is safe because categories are upserted by their unique slug.

## Project structure

```text
src/
├── app/
│   ├── config/
│   ├── errors/
│   ├── middlewares/
│   ├── modules/
│   │   └── health/
│   ├── routes/
│   └── utils/
├── generated/          # Prisma generated output; not committed
├── lib/
│   └── prisma.ts
├── app.ts
└── server.ts

prisma/
├── migrations/         # Generated locally by Prisma Migrate and committed
├── schema.prisma
└── seed.ts

docs/
└── DATA_MODEL.md
```

Business modules will use the same modular pattern where applicable:

```text
module/
├── module.constant.ts
├── module.controller.ts
├── module.interface.ts
├── module.route.ts
├── module.service.ts
└── module.validation.ts
```

## Local-only Postman files

Some future commit ZIPs will include a `/postman` folder with the minimum requests needed to verify that commit. `/postman` is already ignored by Git and should not be force-added.

## Commit message

```text
feat: define procurement database schema and seed data
```
