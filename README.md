# ProcuraX Backend

ProcuraX is a modular B2B procurement backend built with Express, TypeScript, Prisma, PostgreSQL/Neon, JWT authentication, and Stripe-ready payment architecture.

## Current implementation

Commits 01–07 now provide:

- production-oriented Express/TypeScript foundation
- PostgreSQL/Neon + Prisma data model
- secure email/password and Google authentication
- refresh-token rotation and account recovery
- buyer/supplier/admin roles
- supplier onboarding, category specialization, and admin verification
- buyer RFQ draft/publish/discovery lifecycle
- verified supplier quotation submission, editing, withdrawal, and server-side pricing
- audit logging, validation, rate limiting, Helmet, and CORS
- automated domain verification via `npm run verify`

Local development documentation and the canonical Postman collection remain ignored until the final submission commit.
