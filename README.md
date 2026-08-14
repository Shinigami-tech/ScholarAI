# ScholarAI

ScholarAI is a document-first academic intelligence platform built with Next.js App Router, TypeScript, and the Gemini API.

## What this version contains

- Existing ScholarAI document analysis + Drake chat.
- Free / Pro / Premium plan definitions.
- Daily usage-unit system with demo fallback for local development.
- Gemini model configuration through environment variables.
- Authentication API using Supabase Auth REST endpoints.
- Supabase Postgres schema for profiles, analyses, and usage events.
- Stripe Checkout + Billing Portal + webhook endpoints (REST, no Stripe SDK required).
- Learning Lab with all 12 planned feature areas:
  1. AI Study Mode
  2. Smart Document
  3. Exam Mode
  4. AI Flashcards
  5. Quiz Generator
  6. Knowledge Map
  7. Source Mode
  8. Math Solver
  9. Voice Tutor
  10. Camera Homework
  11. Personal Progress
  12. Gamification
- Account, pricing, and admin pages.
- Server-only Gemini key usage.

## Important production notes

The current code is designed so the app can run locally in demo mode without Supabase/Stripe configured. Set `ALLOW_DEMO_MODE=false` before production.

The Gemini API is usage-priced and rate-limited. Configure a paid Google AI Studio/Gemini API project for production workloads. The app adds its own per-user usage limits on top of Google's project/model limits.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Gemini API key.
4. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
5. Add the Supabase URL, publishable key, service-role key, and `ADMIN_EMAILS`.
6. Create Stripe recurring Prices for Pro and Premium, then add their IDs.
7. Set the Stripe webhook endpoint to `/api/stripe/webhook` and subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
8. Run `npm run dev`.
9. Test authentication, AI usage, limits, checkout in Stripe Test Mode, and the webhook lifecycle before switching Stripe to Live Mode.

## Environment variables

See `.env.example`.

## Recommended production safety

- Restrict your Gemini API key to the intended Google Cloud project.
- Never expose `GEMINI_API_KEY` to client-side code.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Keep Stripe secret keys server-only.
- Set `ALLOW_DEMO_MODE=false` in production.
- Keep user limits and a project-level budget/spend alert enabled.
