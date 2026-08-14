# ScholarAI – exact replacement & setup guide

## 1. Replace the project

Back up your current folder. Replace it with the contents of this ZIP, or merge the files from the ZIP into the existing project.

## 2. Environment

Create `.env.local` from `.env.example` and fill these values:

- GEMINI_API_KEY
- GEMINI_MODEL_FAST
- GEMINI_MODEL_REASONING
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_PRO
- STRIPE_PRICE_PREMIUM
- NEXT_PUBLIC_SITE_URL
- ADMIN_EMAILS
- ALLOW_DEMO_MODE

Set `ALLOW_DEMO_MODE=true` only for local development. Set `false` in production.

## 3. Supabase

Create a Supabase project and execute `supabase/schema.sql` in the Supabase SQL Editor.

Enable email/password authentication.

Copy:
- Project URL -> NEXT_PUBLIC_SUPABASE_URL
- Publishable key -> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- Service role key -> SUPABASE_SERVICE_ROLE_KEY

Keep the service role key server-only.

## 4. Stripe

Create recurring prices for:
- Pro: $6.99/month
- Premium: $12.99/month

Copy the two Price IDs into the environment file.

Create a webhook endpoint:
`https://YOUR_DOMAIN/api/stripe/webhook`

Enable these events:
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted

Copy the webhook signing secret into STRIPE_WEBHOOK_SECRET.

Start in Stripe Test Mode.

## 5. Gemini

Use a paid Gemini API project for production. Keep the API key on the server. The app defaults to `gemini-2.5-flash` unless you set a different supported model in the environment variables.

Google rate limits are project/model/tier dependent, so keep both Google-side quotas/spend controls and the ScholarAI user/unit limits.

## 6. Local run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Useful routes:
- `/` main ScholarAI
- `/tools` Learning Lab
- `/pricing` plans
- `/login` auth
- `/account` account/billing
- `/admin` admin dashboard

## 7. First tests

1. Open `/login` and create a test account.
2. Verify the profile is created in Supabase.
3. Run a simple chat request.
4. Upload a small PDF.
5. Check daily usage.
6. Test the 5-unit Free limit.
7. Upgrade using Stripe Test Mode.
8. Confirm webhook updates the plan.
9. Confirm Pro receives the higher daily allowance.
10. Open `/account` and verify the billing portal.
11. Test the Learning Lab tools.
12. Test camera/voice on a browser that supports them.

## 8. What is intentionally not hardcoded

- Gemini pricing
- Google rate limits
- Stripe processing fees
- exact infrastructure cost
- final production domain

Those depend on the accounts and deployment environment and should not be guessed in code.
