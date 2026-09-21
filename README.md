# ProcuraX Backend

ProcuraX is a modular B2B procurement backend built with Express, TypeScript, Prisma and PostgreSQL.

## Current implementation

- secure email/password and Google authentication
- BUYER, SUPPLIER and ADMIN authorization
- supplier onboarding, category specialization and verification
- buyer RFQ draft/publish/discovery lifecycle
- supplier quotation submission and management
- buyer quotation comparison and evaluation
- transactional quotation award and purchase-order issuance
- purchase-order ownership, acceptance, rejection and fulfillment state management
- audit logging, soft-delete-aware queries and pagination/filtering

## Development verification

```bash
npm run verify
```

`verify` runs TypeScript checking, automated domain tests and a production build. Formatting/lint cleanup is intentionally reserved for the final quality pass.

Internal `docs/` and the evolving canonical Postman collection stay local until the final submission commit.
