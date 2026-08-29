import { NextResponse } from "next/server";
import { verifyPaddleSignature } from "@/lib/paddle-rest";
import { adminRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

// Replaces app/api/stripe/webhook/route.ts. Point Paddle Dashboard >
// Notifications at https://scholarai.study/api/paddle/webhook and select
// at least: subscription.created, subscription.updated, subscription.canceled.
// PADDLE_WEBHOOK_SECRET comes from that same notification destination
// (Paddle issues one secret per destination, prefixed ntfset_).
type PaddleEvent = {
  event_type?: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string;
    custom_data?: { userId?: string; plan?: string } | null;
  };
};

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  try {
    verifyPaddleSignature(body, signature, secret);
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Invalid signature", { status: 400 });
  }

  try {
    const event = JSON.parse(body) as PaddleEvent;
    const data = event.data;
    const userId = data?.custom_data?.userId;

    if (!userId) {
      // Not every Paddle event carries our custom_data (e.g. transaction
      // events unrelated to a subscription) — nothing to do, but still
      // acknowledge so Paddle doesn't retry forever.
      return NextResponse.json({ received: true });
    }

    if (event.event_type === "subscription.created" || event.event_type === "subscription.updated") {
      const plan = data?.status === "canceled" || data?.status === "paused" ? "FREE" : data?.custom_data?.plan || "PRO";
      await adminRest("profiles", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(userId)}`,
        body: {
          plan,
          subscription_status: data?.status || "active",
          paddle_customer_id: data?.customer_id ?? null,
          paddle_subscription_id: data?.id ?? null,
        },
      });
    }

    if (event.event_type === "subscription.canceled") {
      await adminRest("profiles", {
        method: "PATCH",
        query: `id=eq.${encodeURIComponent(userId)}`,
        body: {
          plan: "FREE",
          subscription_status: "canceled",
          paddle_subscription_id: data?.id ?? null,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Webhook processing failed", { status: 500 });
  }
}
