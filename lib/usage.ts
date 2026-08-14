import {
  adminRest,
  getSupabaseUser,
} from "@/lib/supabase-rest";

import {
  getPlan,
  getPlanConfig,
  UNIT_COSTS,
  type Plan,
  type UsageFeature,
} from "@/lib/plans";

export type UsageSnapshot = {
  plan: Plan;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
};

type ApiUser = {
  id: string;
  email: string | null;
};

const memory = new Map<
  string,
  {
    day: string;
    used: number;
    plan: Plan;
  }
>();

function nextReset() {
  const d = new Date();

  d.setUTCHours(
    24,
    0,
    0,
    0
  );

  return d.toISOString();
}

function dayKey() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

export async function getCurrentUser() {
  if (
    !process.env
      .NEXT_PUBLIC_SUPABASE_URL ||
    !process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  return getSupabaseUser();
}

export async function getUsage(
  userId: string
): Promise<UsageSnapshot> {
  if (
    userId === "demo-user"
  ) {
    const e =
      memory.get(userId);

    if (
      !e ||
      e.day !== dayKey()
    ) {
      memory.set(
        userId,
        {
          day: dayKey(),
          used: 0,
          plan: "FREE",
        }
      );

      return {
        plan: "FREE",
        used: 0,
        limit: 5,
        remaining: 5,
        resetAt:
          nextReset(),
      };
    }

    const limit =
      getPlanConfig(
        e.plan
      ).dailyUnits;

    return {
      plan: e.plan,
      used: e.used,
      limit,
      remaining:
        Math.max(
          0,
          limit - e.used
        ),
      resetAt:
        nextReset(),
    };
  }

  const rows =
    await adminRest(
      "profiles",
      {
        query: `id=eq.${encodeURIComponent(
          userId
        )}&select=plan,daily_units,daily_units_reset_at`,
      }
    );

  const row =
    rows?.[0];

  const plan =
    getPlan(
      row?.plan
    );

  const limit =
    getPlanConfig(
      plan
    ).dailyUnits;

  const reset =
    row?.daily_units_reset_at
      ? new Date(
          row.daily_units_reset_at
        )
      : new Date(0);

  if (
    reset.getTime() <=
    Date.now()
  ) {
    const resetAt =
      nextReset();

    await adminRest(
      "profiles",
      {
        method: "PATCH",

        query: `id=eq.${encodeURIComponent(
          userId
        )}`,

        body: {
          daily_units: 0,
          daily_units_reset_at:
            resetAt,
        },
      }
    );

    return {
      plan,
      used: 0,
      limit,
      remaining:
        limit,
      resetAt,
    };
  }

  const used =
    Number(
      row?.daily_units ||
        0
    );

  return {
    plan,
    used,
    limit,

    remaining:
      Math.max(
        0,
        limit - used
      ),

    resetAt:
      reset.toISOString(),
  };
}

export async function consumeUsage(
  userId: string,
  feature: UsageFeature,
  units =
    UNIT_COSTS[feature]
) {
  if (units <= 0) {
    return getUsage(
      userId
    );
  }

  const current =
    await getUsage(
      userId
    );

  if (
    current.remaining <
    units
  ) {
    const error =
      new Error(
        `Daily ScholarAI limit reached. ${current.remaining} unit(s) remaining.`
      ) as Error & {
        code?: string;
      };

    error.code =
      "USAGE_LIMIT_REACHED";

    throw error;
  }

  if (
    userId ===
    "demo-user"
  ) {
    const e =
      memory.get(
        userId
      ) || {
        day: dayKey(),
        used: 0,
        plan:
          current.plan,
      };

    e.used += units;

    memory.set(
      userId,
      e
    );

    return {
      ...current,
      used: e.used,

      remaining:
        current.remaining -
        units,
    };
  }

  const next =
    current.used +
    units;

  await adminRest(
    "profiles",
    {
      method: "PATCH",

      query: `id=eq.${encodeURIComponent(
        userId
      )}`,

      body: {
        daily_units:
          next,

        daily_units_reset_at:
          current.resetAt,

        updated_at:
          new Date().toISOString(),
      },
    }
  );

  await adminRest(
    "usage_events",
    {
      method: "POST",

      body: {
        user_id:
          userId,
        feature,
        units,
      },
    }
  );

  return {
    ...current,
    used: next,

    remaining:
      current.remaining -
      units,
  };
}

export async function requireUserForApi(): Promise<ApiUser> {
  const user =
    await getCurrentUser();

  if (user) {
    return {
      id: user.id,
      email:
        user.email ??
        null,
    };
  }

  if (
    process.env
      .ALLOW_DEMO_MODE ===
    "true"
  ) {
    return {
      id: "demo-user",
      email:
        "demo@scholarai.local",
    };
  }

  const error =
    new Error(
      "AUTH_REQUIRED"
    ) as Error & {
      code?: string;
    };

  error.code =
    "AUTH_REQUIRED";

  throw error;
}