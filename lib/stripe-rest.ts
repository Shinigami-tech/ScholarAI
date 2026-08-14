import crypto from "node:crypto";

type StripeApiResponse = {
  error?: {
    message?: string;
  };
  [key: string]: unknown;
};

function getKey() {
  const key =
    process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured."
    );
  }

  return key;
}

async function stripePost(
  path: string,
  params: Record<string, string>
) {
  const body =
    new URLSearchParams(params);

  const response =
    await fetch(
      `https://api.stripe.com/v1/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${getKey()}:`
          ).toString("base64")}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body,
        cache: "no-store",
      }
    );

  const data =
    (await response.json()) as StripeApiResponse;

  if (!response.ok) {
    const errorMessage =
      data.error?.message ||
      "Stripe API request failed.";

    throw new Error(errorMessage);
  }

  return data;
}

export async function createCheckoutSession(
  args: {
    priceId: string;
    email?: string | null;
    userId: string;
    plan: string;
    origin: string;
  }
) {
  const params: Record<
    string,
    string
  > = {
    mode: "subscription",

    "line_items[0][price]":
      args.priceId,

    "line_items[0][quantity]":
      "1",

    success_url:
      `${args.origin}/?checkout=success`,

    cancel_url:
      `${args.origin}/?checkout=cancelled`,

    "metadata[userId]":
      args.userId,

    "metadata[plan]":
      args.plan,

    "subscription_data[metadata][userId]":
      args.userId,

    "subscription_data[metadata][plan]":
      args.plan,

    allow_promotion_codes:
      "true",
  };

  if (args.email) {
    params.customer_email =
      args.email;
  }

  return stripePost(
    "checkout/sessions",
    params
  );
}

export async function createBillingPortal(
  customerId: string,
  returnUrl: string
) {
  return stripePost(
    "billing_portal/sessions",
    {
      customer: customerId,
      return_url: returnUrl,
    }
  );
}

export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
) {
  const parts =
    Object.fromEntries(
      signature
        .split(",")
        .map((part) =>
          part.split("=")
        )
    );

  const timestamp =
    parts.t;

  const provided =
    parts.v1;

  if (
    !timestamp ||
    !provided
  ) {
    throw new Error(
      "Invalid Stripe signature."
    );
  }

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        `${timestamp}.${payload}`,
        "utf8"
      )
      .digest("hex");

  const expectedBuffer =
    Buffer.from(expected);

  const providedBuffer =
    Buffer.from(provided);

  if (
    expectedBuffer.length !==
      providedBuffer.length ||
    !crypto.timingSafeEqual(
      expectedBuffer,
      providedBuffer
    )
  ) {
    throw new Error(
      "Invalid Stripe signature."
    );
  }

  if (
    Math.abs(
      Date.now() / 1000 -
        Number(timestamp)
    ) > 300
  ) {
    throw new Error(
      "Stripe webhook timestamp is too old."
    );
  }
}