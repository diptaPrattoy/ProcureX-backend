# Production Deployment — Vercel + Neon + Upstash + Stripe

ProcuraX is designed for a stateless Node/Vercel deployment.

## 1. Neon

Create or select the production/demo Neon database.

Use:

```env
DATABASE_URL=<POOLED_-pooler_NEON_URL>
DIRECT_URL=<DIRECT_NON_POOLER_NEON_URL>
```

Keep `sslmode=require` if provided by Neon.

Before deployment, apply migrations from a trusted machine/CI environment:

```bash
npm run db:deploy
npm run prisma:generate
npm run db:seed
```

The seed creates reference procurement categories and, when configured, the demo admin.

## 2. Upstash Redis

Create an Upstash Redis database and copy the REST values:

```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
CACHE_ENABLED=true
RATE_LIMIT_ENABLED=true
```

The TCP `redis-cli -u redis://...` connection string is not used by ProcuraX.

## 3. Google OAuth

Create a Google OAuth **Web application** client.

For the future frontend, add its URL to Authorized JavaScript origins, for example:

```text
https://your-frontend.vercel.app
```

Set:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
```

The current backend verifies Google ID tokens; it does not require a Google redirect callback route.

## 4. SMTP

Production environment validation requires:

```env
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM_NAME=ProcuraX
MAIL_FROM_EMAIL=...
```

## 5. Stripe

Configure:

```env
STRIPE_SECRET_KEY=sk_test_...        # use test mode for evaluation unless instructed otherwise
STRIPE_SUCCESS_URL=https://YOUR_FRONTEND/payments/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://YOUR_FRONTEND/payments/cancel
```

After the backend is deployed, register the Stripe webhook endpoint:

```text
https://YOUR_API_DOMAIN/api/v1/payments/webhooks/stripe
```

Subscribe to the payment/refund events required by the application, then copy the endpoint signing secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Never use a Stripe CLI `whsec_...` secret as the deployed Dashboard webhook secret; each endpoint has its own signing secret.

## 6. Vercel environment

Set `NODE_ENV=production` and all required environment variables in the Vercel project.

Example production values:

```env
NODE_ENV=production
API_PREFIX=/api/v1
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
CLIENT_APP_URL=https://YOUR_FRONTEND_DOMAIN
STRIPE_SUCCESS_URL=https://YOUR_FRONTEND_DOMAIN/payments/success?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://YOUR_FRONTEND_DOMAIN/payments/cancel
```

Production validation intentionally rejects wildcard CORS and non-HTTPS browser/payment URLs.

## 7. Deploy

Connect the GitHub repository to Vercel and deploy using Node 22. `postinstall` runs `prisma generate`, so the generated Prisma client does not need to be committed.

After deployment verify:

```text
GET https://YOUR_API_DOMAIN/api/v1/health
```

Then update Stripe webhook configuration with the final API domain.

## 8. Final production smoke test

Check at minimum:

1. health endpoint;
2. buyer login;
3. supplier login;
4. admin login;
5. one protected role endpoint and one expected 403;
6. categories/public supplier endpoint;
7. Stripe Checkout session creation on a valid approved invoice;
8. Stripe webhook delivery succeeds with HTTP 2xx;
9. payment state updates in Neon;
10. Redis-enabled health/config behavior.

## 9. Submission URLs

After deployment update the root README with:

- Backend repository URL
- Live API URL
- Published Postman documentation URL
- Demo video URL
