# Security Key Rotation Checklist

## Rotation Date
- 2026-02-19

## Completed (Local)
1. Rotated `JWT_SECRET` in:
- `/Users/eric/Desktop/secondme/projects/POS/pos-backend/.env`
- `/Users/eric/Desktop/secondme/projects/POS/pos-backend/.env.local`

2. Added secret hygiene ignores:
- `/Users/eric/Desktop/secondme/projects/POS/pos-backend/.gitignore`
- `/Users/eric/Desktop/secondme/projects/POS/.gitignore`

## Required Manual Rotation (External Consoles)
1. MongoDB Atlas:
- Rotate DB user password used by `MONGODB_URI`.
- Update both backend env files with the new URI.

2. Stripe:
- Rotate `STRIPE_SECRET_KEY`.
- Rotate `STRIPE_WEBHOOK_SECRET`.
- Update backend env files.

## Validation After Rotation
1. Backend auth:
- Login endpoint issues cookie successfully.

2. Online payment:
- `/api/payment/create-order` works.
- `/api/payment/verify-payment` succeeds.
- `/api/payment/webhook-verification` signature verification succeeds.

3. Order placement:
- Online order amount matches server-side computed amount.
