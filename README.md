# ProcuraX Backend

ProcuraX is a backend-first B2B procurement platform for RFQs, competitive supplier quotations, purchase orders, goods receipts, invoicing, disputes, payments, and auditability.

## Stack

- Node.js + Express 5
- TypeScript
- PostgreSQL (Neon)
- Prisma ORM
- Zod
- JWT access tokens + rotating opaque refresh tokens
- Stripe (payment module in a later commit)

## Current implementation

Commit 03 adds the authentication foundation:

- Buyer registration
- Supplier registration with `PENDING` verification state
- Email/password login
- JWT Bearer access tokens
- Rotating database-backed refresh tokens
- Logout/revocation
- Protected current-user endpoint
- Role-aware authentication middleware
- Authentication rate limiting
- Registration/login audit logs

See `docs/AUTHENTICATION.md` and `docs/DATA_MODEL.md` for design rules.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add your Neon pooled and direct connection strings.
3. Generate a strong access-token secret and add the authentication environment values.
4. Run `npm install`.
5. Run `npm run prisma:generate`.
6. Apply existing migrations with `npm run db:migrate` during development or `npm run db:deploy` in deployment environments.
7. Run `npm run db:seed` when reference data is needed.
8. Start with `npm run dev`.

Generate a local JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## API base URL

```text
http://localhost:5000/api/v1
```

Important routes in this commit:

```text
POST /auth/register/buyer
POST /auth/register/supplier
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
GET  /health
```

## Local Postman collection

`postman/` is intentionally ignored by Git during development. It is supplied only for local testing and will be cleaned up and committed as final API documentation near project completion.
