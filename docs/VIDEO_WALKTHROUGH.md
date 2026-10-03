# 5–10 Minute Video Walkthrough Plan

Use Postman and the deployed API. Keep the explanation focused on business flow and one or two technical decisions rather than showing all 80+ endpoints.

## 0:00–0:45 — Project overview

Explain:

- ProcuraX is a B2B procurement backend;
- three roles: Buyer, Supplier, Admin;
- stack: Express/TypeScript, Prisma/PostgreSQL, Stripe, Redis;
- architecture: Route → Middleware → Controller → Service → Prisma.

## 0:45–1:45 — Authentication and RBAC

Show:

- buyer login;
- supplier/admin login briefly;
- `GET /auth/me`;
- one intentional forbidden request showing `403` when the wrong role tries an endpoint.

Mention Google login and refresh-token rotation.

## 1:45–3:30 — Main procurement workflow

Show a prepared canonical flow rather than creating everything from scratch:

1. Buyer RFQ.
2. Supplier quotation.
3. Buyer evaluation/award.
4. Resulting Purchase Order.

Explain the award transaction: winning quote, losing quotes, RFQ, PO, audit records update atomically.

## 3:30–4:45 — Receiving and invoicing

Show:

- goods receipt with accepted/rejected quantities;
- invoice created only from accepted quantities;
- buyer invoice review/approval.

Explain why supplier cannot self-declare received goods.

## 4:45–6:15 — Stripe payment

Show:

- Checkout session creation;
- Stripe test Checkout/Payment;
- webhook delivery;
- resulting Payment/Invoice status in API/database.

Mention raw-body signature verification and WebhookEvent idempotency.

## 6:15–7:00 — Validation/error handling

Show one or two:

- invalid request → structured Zod error;
- 401 without token;
- 404 for missing entity;
- duplicate/invalid workflow state error.

## 7:00–8:00 — Admin and advanced features

Show:

- supplier verification or refund/dispute review;
- admin dashboard overview;
- audit logs;
- notifications.

Mention Redis caching and distributed rate limiting.

## 8:00–9:00 — Technical challenge

Recommended challenge to explain:

**Transactional quotation award + PO issuance**

or

**Stripe webhook idempotency and serverless-safe reconciliation**.

Explain the problem, the failure mode without protection, and the transaction/idempotency solution.

## Final 15 seconds

Show the live health endpoint and GitHub/Postman documentation links.
