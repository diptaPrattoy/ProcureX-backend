# Postman Collection

Final collection:

```text
postman/ProcuraX.postman_collection.json
```

It contains the canonical development/evaluation workflow for all three roles.

## Canonical demo identities

```text
BUYER
buyer@example.com
StrongPass123!

SUPPLIER
supplier@example.com
StrongPass123!

ADMIN
admin@procurax.local
AdminPass123!
```

The buyer and supplier are created by collection requests if needed. The admin is seeded by the backend.

## Running the workflow

Set `baseUrl` to either:

```text
http://localhost:5000/api/v1
```

or the deployed API:

```text
https://YOUR_API_DOMAIN/api/v1
```

Run folders in numeric order. Test scripts save access/refresh tokens and entity IDs into collection variables.

The canonical business scenario uses:

- Northstar Manufacturing Ltd. as buyer;
- Apex Industrial Supplies Ltd. as supplier;
- IT & Electronics category;
- a laptop procurement RFQ;
- a quotation, award, purchase order, receipt, invoice, payment, refund/dispute lifecycle.

This keeps the database coherent instead of creating unrelated test users/entities per module.

## Stripe webhooks

Do not manually forge signed webhook requests from Postman. Use:

- Stripe CLI forwarding during local testing, or
- Stripe Dashboard webhook delivery against the deployed endpoint.

The webhook endpoint is:

```text
POST /api/v1/payments/webhooks/stripe
```

## Publishing documentation

Before submission:

1. Import/open the final collection in Postman.
2. Set examples/descriptions if you want additional presentation polish.
3. Publish the collection/documentation from Postman.
4. Copy the public documentation URL.
5. Put it in the root README and assignment submission form.

Do not publish real Stripe/Google/SMTP/Neon/Redis secrets. The collection contains no production secret keys.
