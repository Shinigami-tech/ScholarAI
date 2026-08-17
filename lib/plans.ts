export type Plan = "FREE" | "PRO" | "PREMIUM";

export type PlanConfig = {
  id: Plan;
  name: string;
  priceMonthlyUsd: number;
  dailyUnits: number;
};

export const PLANS: Record<Plan, PlanConfig> = {
  FREE: { id: "FREE", name: "Free", priceMonthlyUsd: 0, dailyUnits: 20 },
  PRO: { id: "PRO", name: "Pro", priceMonthlyUsd: 6.99, dailyUnits: 75 },
  PREMIUM: { id: "PREMIUM", name: "Premium", priceMonthlyUsd: 12.99, dailyUnits: 200 },
};

export const UNIT_COSTS = {
  chat: 1,
  analyze: 2,
  translate: 1,
  study: 2,
  smartDocument: 2,
  exam: 3,
  flashcards: 2,
  quiz: 2,
  knowledgeMap: 2,
  math: 1,
  voice: 1,
  camera: 2,
  progress: 0,
  source: 1,
  gamification: 0,
} as const;

export type UsageFeature = keyof typeof UNIT_COSTS;

export function getPlan(value?: string | null): Plan {
  if (value === "PRO" || value === "PREMIUM") return value;
  return "FREE";
}

export function getPlanConfig(plan: Plan) {
  return PLANS[plan];
}
