import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/usage";
import { adminRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

type Profile = {
  plan?: string | null;
  daily_units?: number | null;
  subscription_status?: string | null;
  created_at?: string | null;
};

type UsageEvent = {
  feature?: string | null;
  units?: number | null;
  created_at?: string | null;
};

type PlanCounts = Record<string, number>;

export async function GET() {
  try {
    const user = await getCurrentUser();

    const admins = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (
      !user ||
      !user.email ||
      !admins.includes(user.email.toLowerCase())
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const profiles =
      (await adminRest("profiles", {
        query:
          "select=id,plan,daily_units,subscription_status,created_at",
      })) as Profile[] | null;

    const events =
      (await adminRest("usage_events", {
        query:
          "select=feature,units,created_at&order=created_at.desc&limit=1000",
      })) as UsageEvent[] | null;

    const byPlan =
      (profiles || []).reduce<PlanCounts>(
        (counts, profile) => {
          const plan = profile.plan || "UNKNOWN";

          counts[plan] =
            (counts[plan] || 0) + 1;

          return counts;
        },
        {}
      );

    const units =
      (events || []).reduce(
        (sum, event) =>
          sum + Number(event.units || 0),
        0
      );

    return NextResponse.json({
      users: profiles?.length || 0,
      byPlan,
      events: events?.length || 0,
      units,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Admin stats failed.",
      },
      { status: 500 }
    );
  }
}