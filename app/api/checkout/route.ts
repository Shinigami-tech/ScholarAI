import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/usage";
import { createTransaction } from "@/lib/paddle-rest";

export const runtime = "nodejs";

// Paddle.js OVERLAY checkout (hosted checkout was denied for this account).
// pricing/page.tsx now calls Paddle.Checkout.open({ transactionId }) directly
// in the browser, so this route just creates the transaction and returns its
// id — no hosted checkout URL needed.
//
// Needs these env vars in Vercel (Production + any Preview you test with):
//   PADDLE_API_KEY       — secret, from Paddle Dashboard > Developer tools > Authentication
//   PADDLE_ENV            — "sandbox" (default) or "production"
//   PADDLE_PRICE_PRO       — pri_... id for the Pro plan
//   PADDLE_PRICE_PREMIUM   — pri_... id for the Premium plan
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const { plan } = (await request.json()) as { plan?: string };
    const priceId = plan === "PREMIUM" ? process.env.PADDLE_PRICE_PREMIUM : plan === "PRO" ? process.env.PADDLE_PRICE_PRO : null;
    if (!priceId) {
      return NextResponse.json({ error: "Paddle price ID is not configured for this plan." }, { status: 400 });
    }

    const transaction = await createTransaction({
      priceId,
      email: user.email,
      userId: user.id,
      plan: plan as string,
    });

    return NextResponse.json({ transactionId: transaction.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 500 });
  }
}
