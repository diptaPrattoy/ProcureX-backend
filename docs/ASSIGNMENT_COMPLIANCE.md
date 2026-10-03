# Assignment Compliance Matrix

| Requirement | ProcuraX implementation |
|---|---|
| Unique industry project | B2B procurement / vendor management / procure-to-pay workflow |
| 3 fixed roles | BUYER, SUPPLIER, ADMIN |
| Node + TypeScript + Express | Express 5 modular TypeScript API |
| PostgreSQL + Prisma | Neon PostgreSQL + Prisma 7, relations/constraints/indexes/migrations |
| 20+ meaningful APIs | 80+ application routes; final Postman contains 78 organized requests |
| API versioning | `/api/v1` |
| Consistent responses | centralized success utilities + global structured error middleware |
| Bearer auth | short-lived JWT access token |
| Email/password auth | bcrypt password flow |
| Google/GCP social login | Google Identity Services ID-token verification |
| Strict RBAC | route middleware for BUYER / SUPPLIER / ADMIN |
| Zod validation | body/query validation across applicable endpoints |
| Pagination | supplier/RFQ/quotation/PO/invoice/payment/refund/dispute/audit/notification listings |
| Filtering/sorting/search | domain-relevant list filters and search |
| Soft delete | selected user-facing entities use `deletedAt`, including RFQ deletion endpoint |
| Audit/activity | AuditLog persistence + user activity + admin audit APIs |
| Business logic | procurement state machines, quantity/financial checks, approval workflows |
| Transactions/concurrency | quotation award, receiving, invoicing, payment/refund reconciliation, guarded state transitions |
| Indexing | extensive Prisma indexes for operational query paths |
| Redis caching | Upstash caching for categories, suppliers, analytics |
| Rate limiting | auth/global limits; Upstash distributed limiter in production |
| Helmet | enabled globally |
| CORS | explicit origin allow-list |
| Payment mandatory | real Stripe Checkout, signed webhooks, status tracking, refunds |
| Webhook idempotency | persisted Stripe provider event IDs |
| Postman documentation | final collection committed under `postman/` |
| Admin credentials | seeded demo admin documented in README |
| Deployment readiness | Vercel/Node 22, Neon pool, Upstash, production env validation |
| Automated verification | `npm run verify` + domain tests + production build |
| 20 meaningful commits | project developed as 20 scoped commits |
| Video guide | `docs/VIDEO_WALKTHROUGH.md` |

## Items that require the student's external URLs

The code repository cannot create these external artifacts automatically. Before submission, provide:

- deployed Vercel API URL;
- published Postman documentation URL;
- 5–10 minute Loom/Drive video URL;
- final GitHub repository URL.
