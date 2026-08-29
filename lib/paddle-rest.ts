import crypto from "node:crypto";

// Paddle Billing REST helper — mirrors lib/stripe-rest.ts's shape so the
// rest of the app (checkout route, webhook route) stays easy to follow.
//
// IMPORTANT — this integration has NOT been tested against a live Paddle
// account (no API keys were available while writing it). Before relying
// on this in production:
//   1. Test the full purchase flow end-to-end in Paddle's Sandbox.
//   2. Confirm the hosted checkout URL format still matches Paddle's
//      current docs (https://developer.paddle.com/paddlejs/hosted-checkout-url-parameters) —
//      Paddle occasionally evolves this.
//   3. Confirm custom_data actually arrives on the subscription.created /
//      subscription.updated webhook payloads for your account.

type PaddleApiResponse = {
  error?: { code?: string; detail?: string };
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

function getApiKey() {
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key) {
    throw new Error("PADDLE_API_KEY is not configured.");
  }
  return key;
}

// Sandbox vs production is a completely separate Paddle environment (own
// keys, own dashboard, own data) — PADDLE_ENV picks which API host we
// talk to. Defaults to sandbox so a missing/forgotten env var fails safe
// (test mode) rather than accidentally hitting production.
function getApiBase() {
  const env = process.env.PADDLE_ENV?.trim().toLowerCase();
  return env === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

async function paddleRequest(path: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = (await response.json()) as PaddleApiResponse;

  if (!response.ok) {
    throw new Error(data.error?.detail || `Paddle API request failed (${response.status}).`);
  }

  return data;
}

// Creates a draft transaction for a subscription price and returns it.
// The caller builds a hosted checkout URL from the returned transaction
// id (see app/api/checkout/route.ts) — this keeps the same
// "server creates a checkout, client redirects to it" shape the Stripe
// integration used, so pricing/page.tsx needed no changes at all.
export async function createTransaction(args: { priceId: string; email?: string | null; userId: string; plan: string }) {
  const result = await paddleRequest("/transactions", "POST", {
    items: [{ price_id: args.priceId, quantity: 1 }],
    custom_data: {
      userId: args.userId,
      plan: args.plan,
    },
    ...(args.email ? { customer: { email: args.email } } : {}),
  });

  const id = result.data?.id;
  if (typeof id !== "string") {
    throw new Error("Paddle did not return a transaction id.");
  }
  return { id };
}

// See https://developer.paddle.com/webhooks/signature-verification —
// header shape is "ts=<unix-seconds>;h1=<hmac-sha256-hex>", signing the
// exact raw body as `${ts}:${rawBody}`. Deliberately mirrors
// verifyStripeSignature's structure/safety checks (timing-safe compare,
// reject stale timestamps) for consistency.
export function verifyPaddleSignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(";").map((part) => part.split("=")));
  const timestamp = parts.ts;
  const provided = parts.h1;

  if (!timestamp || !provided) {
    throw new Error("Invalid Paddle signature header.");
  }

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}:${rawBody}`, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new Error("Invalid Paddle signature.");
  }

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("Paddle webhook timestamp is too old.");
  }
}
