# Authentication and Session Security

## Identity methods

ProcuraX supports:

1. email/password authentication;
2. Google Identity Services ID-token authentication.

Public registration can create `BUYER` or `SUPPLIER` accounts only. `ADMIN` is created through the controlled seed path.

## Access tokens

Access tokens are short-lived signed JWTs and are sent using:

```http
Authorization: Bearer <token>
```

Protected requests re-check account status/deletion state, so an unexpired JWT does not keep a suspended/deleted account active.

## Refresh tokens

Refresh tokens are opaque random secrets. ProcuraX stores only SHA-256 hashes in PostgreSQL.

Refresh flow:

```text
valid refresh token
    ↓
atomically revoke old token
    ↓
issue new refresh token + access JWT
```

Reusing an already-rotated/revoked token is rejected.

## Google authentication

The future frontend obtains a Google Identity Services credential (ID token) and sends it to:

```http
POST /api/v1/auth/google
```

The backend verifies it against `GOOGLE_CLIENT_ID`. New Google users must choose either `BUYER` or `SUPPLIER`; Google/public signup can never create an `ADMIN`.

## Email verification

Verification tokens are random one-time values. Only their hash is stored. Local development can use `EMAIL_DELIVERY_MODE=console`; production requires SMTP.

## Password reset

Forgot-password returns a generic response to reduce account enumeration. Reset tokens are one-time and hashed. A successful password reset revokes all active refresh sessions for the user.

## Demo admin

The demo admin is seeded using environment variables:

```env
SEED_ADMIN_EMAIL=admin@procurax.local
SEED_ADMIN_PASSWORD=AdminPass123!
SEED_ADMIN_FIRST_NAME=ProcuraX
SEED_ADMIN_LAST_NAME=Admin
```

Run:

```bash
npm run db:seed
```

Use demo credentials only in the assignment/evaluation environment.
