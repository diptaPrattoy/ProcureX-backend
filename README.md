# ProcuraX Backend

ProcuraX is a backend-first B2B procurement platform for RFQs, competitive supplier quotations, purchase orders, goods receipts, invoices, payments, disputes, and compliance-friendly audit trails.

## Current implementation

- Express 5 + TypeScript modular API
- Prisma 7 + PostgreSQL/Neon
- BUYER / SUPPLIER / ADMIN role model
- Email/password authentication with rotating refresh tokens
- Google Identity ID-token authentication
- Email verification and password recovery with hashed one-time tokens
- Optional SMTP delivery with development console mail mode
- Controlled ADMIN seeding
- Audit logging foundation
- Security middleware, rate limiting, CORS and Helmet

## Local setup

1. Copy `.env.example` to `.env`.
2. Add your Neon pooled `DATABASE_URL` and direct `DIRECT_URL`.
3. Generate a strong `JWT_ACCESS_SECRET`.
4. Run `npm install`.
5. Run `npm run prisma:generate`.
6. Run `npm run db:migrate -- --name init_procurement_core` if the initial migration has not already been created.
7. Run `npm run db:seed`.
8. Run `npm run dev`.

The API defaults to `http://localhost:5000/api/v1`.

## Optional Google auth

Create a Google Cloud Web OAuth client and set `GOOGLE_CLIENT_ID`. The future frontend will pass the Google ID token/credential to `POST /api/v1/auth/google`.

## Optional development ADMIN

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env`, then run `npm run db:seed`. Never commit the credentials.


## Current domain capabilities

Authentication, buyer/supplier profiles, procurement category discovery, supplier category selection, public verified-supplier discovery, and ADMIN supplier verification are implemented.
