# Final Submission Checklist

## Repository

- [ ] Commit 20 is pushed.
- [ ] GitHub repository is accessible to evaluator.
- [ ] `README.md` contains final live links.
- [ ] `.env` is not committed.
- [ ] `docs/` is committed.
- [ ] `postman/ProcuraX.postman_collection.json` is committed.
- [ ] At least 20 meaningful commits are visible.

## Database

- [ ] Production/demo Neon database is reachable.
- [ ] All committed migrations are deployed.
- [ ] `npm run db:seed` has run against the evaluation database.
- [ ] Demo admin can log in.

## Vercel

- [ ] Backend deployed successfully.
- [ ] `/api/v1/health` returns success.
- [ ] Node 22 is used.
- [ ] Production CORS points to the correct frontend/origin.

## Google auth

- [ ] `GOOGLE_CLIENT_ID` is configured in Vercel.
- [ ] Frontend origin is authorized in Google Cloud when frontend exists.

## Email

- [ ] `EMAIL_DELIVERY_MODE=smtp` in production.
- [ ] SMTP credentials configured.

## Redis

- [ ] Upstash REST URL/token configured.
- [ ] Cache enabled.
- [ ] Distributed rate limiter enabled.

## Stripe

- [ ] Stripe test/required secret key configured.
- [ ] Deployed webhook endpoint created in Stripe Dashboard.
- [ ] `STRIPE_WEBHOOK_SECRET` matches that deployed endpoint.
- [ ] One successful test payment completed.
- [ ] Webhook updates invoice/payment status correctly.

## Postman

- [ ] Final canonical collection imported and tested against live API.
- [ ] `baseUrl` changed to deployed `/api/v1` URL for evaluation.
- [ ] Collection documentation published publicly.
- [ ] Public Postman docs URL added to README/submission.

## Video

- [ ] 5–10 minute video recorded.
- [ ] Shows all three roles.
- [ ] Shows a 403 RBAC example.
- [ ] Shows CRUD/business flow.
- [ ] Shows validation/error response.
- [ ] Shows real Stripe payment flow.
- [ ] Explains one technical challenge.
- [ ] Video sharing is set to anyone-with-link/viewer.

## Submission format

```text
Project Name    : ProcuraX — B2B Procurement & Vendor Management Platform
Backend Repo    : <YOUR_BACKEND_REPOSITORY_URL>
Live API        : <YOUR_VERCEL_API_URL>
API Docs        : <YOUR_PUBLISHED_POSTMAN_DOCS_URL>
Demo Video      : <YOUR_VIDEO_URL>
Admin Email     : admin@procurax.local
Admin Password  : AdminPass123!
```
