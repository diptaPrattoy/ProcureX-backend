# ProcuraX Backend

ProcuraX is a backend-first B2B procurement platform for managing RFQs, competitive supplier quotations, purchase orders, goods receipts, invoices, and Stripe payments.

## Commit 01 scope

This commit establishes the stable backend foundation only:

- Express 5 + TypeScript (ESM)
- Modular Routes -> Controllers -> Services structure
- Prisma 7 + PostgreSQL/Neon configuration
- Neon pooled runtime connection and direct migration connection
- Zod-validated environment variables
- Helmet, CORS, and global rate limiting
- Centralized error handling and mandatory API response shape
- Database-backed health endpoint
- Graceful shutdown and Prisma connection cleanup
- Biome formatting/linting
- Stripe raw-body mount point reserved before JSON parsing

Domain models and migrations begin in Commit 02 after the ProcuraX ERD is frozen.

## Runtime requirements

- Node.js 22 LTS recommended
- Node.js >= 20.19 supported by this project configuration
- A Neon PostgreSQL project

## Local setup

1. Copy `.env.example` to `.env`.
2. In Neon, copy the **Pooled connection** string into `DATABASE_URL`.
3. Copy the **Direct connection** string into `DIRECT_URL`.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

6. Validate the Prisma configuration:

   ```bash
   npm run prisma:validate
   ```

7. Start development mode:

   ```bash
   npm run dev
   ```

8. Verify:

   ```http
   GET http://localhost:5000/api/v1/health
   ```

Expected response shape:

```json
{
  "success": true,
  "message": "ProcuraX API is healthy",
  "data": {
    "service": "procurax-api",
    "status": "ok",
    "environment": "development",
    "database": "connected"
  }
}
```

## Architecture

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
└── schema.prisma
```

Each business module will follow the same pattern where applicable:

```text
module/
├── module.constant.ts
├── module.controller.ts
├── module.interface.ts
├── module.route.ts
├── module.service.ts
└── module.validation.ts
```

## Git commit

Use this exact style for the first commit:

```text
chore: bootstrap ProcuraX backend architecture
```
