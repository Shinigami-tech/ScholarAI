import { NextResponse } from "next/server";
import { requireUserForApi } from "@/lib/usage";
import { adminRest } from "@/lib/supabase-rest";

export const runtime = "nodejs";

type ProfileRow = {
  points?: number | string | null;
  streak_days?: number | string | null;
  daily_units?: number | string | null;
};

type UsageEventRow = {
  feature?: string | null;
  units?: number | string | null;
  created_at?: string | null;
};

type FeatureTotals = Record<string, number>;

type TopFeature = {
  feature: string;
  units: number;
};

export async function GET() {
  try {
    const user =
      await requireUserForApi();

    if (user.id === "demo-user") {
      return NextResponse.json({
        points: 120,
        streakDays: 3,
        unitsToday: 0,
        topFeatures: [
          {
            feature: "study",
            units: 4,
          },
          {
            feature: "quiz",
            units: 3,
          },
        ],
        achievements: [
          "First Study Session",
          "3-day streak",
        ],
      });
    }

    const profiles =
      (await adminRest("profiles", {
        query:
          `id=eq.${encodeURIComponent(
            user.id
          )}&select=points,streak_days,daily_units`,
      })) as ProfileRow[] | null;

    const events =
      (await adminRest("usage_events", {
        query:
          `user_id=eq.${encodeURIComponent(
            user.id
          )}&select=feature,units,created_at&order=created_at.desc&limit=200`,
      })) as UsageEventRow[] | null;

    const totals =
      (events || []).reduce<FeatureTotals>(
        (accumulator, event) => {
          const feature =
            event.feature || "unknown";

          accumulator[feature] =
            (accumulator[feature] || 0) +
            Number(event.units || 0);

          return accumulator;
        },
        {}
      );

    const topFeatures: TopFeature[] =
      Object.entries(totals)
        .map(
          ([feature, units]) => ({
            feature,
            units,
          })
        )
        .sort(
          (a, b) =>
            b.units - a.units
        );

    return NextResponse.json({
      points: Number(
        profiles?.[0]?.points || 0
      ),

      streakDays: Number(
        profiles?.[0]
          ?.streak_days || 0
      ),

      unitsToday: Number(
        profiles?.[0]
          ?.daily_units || 0
      ),

      topFeatures,

      events:
        events?.length || 0,

      achievements: [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Progress failed.",
      },
      {
        status: 500,
      }
    );
  }
}