"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Plan = {
  id: "FREE" | "PRO" | "PREMIUM";
  name: string;
  price: string;
  limit: string;
  features: string[];
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

const plans: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    limit: "5 units/day",
    features: [
      "Document analysis",
      "Drake chat",
      "Basic study tools",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$6.99",
    limit: "10 units/day",
    features: [
      "All core study tools",
      "Exam Mode",
      "Flashcards & quizzes",
      "Priority feature access",
    ],
  },
  {
    id: "PREMIUM",
    name: "Premium",
    price: "$12.99",
    limit: "30 units/day",
    features: [
      "All Pro features",
      "More advanced operations",
      "Higher daily allowance",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  const [msg, setMsg] = useState("");
  const [loadingPlan, setLoadingPlan] =
    useState<Plan["id"] | null>(null);
  const [currentPlan, setCurrentPlan] =
    useState<Plan["id"] | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (data?.authenticated && data?.usage?.plan) {
          setCurrentPlan(data.usage.plan);
        }
      })
      .catch(() => {});
  }, []);

  async function subscribe(plan: Plan["id"]) {
    setMsg("");
    setLoadingPlan(plan);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data =
        (await response.json()) as CheckoutResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "Checkout failed."
        );
      }

      if (!data.url) {
        throw new Error(
          "Checkout URL was not returned."
        );
      }

      window.location.assign(data.url);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Checkout failed."
      );
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0b",
        color: "#f4f4f5",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{ color: "#fff" }}
        >
          ← ScholarAI
        </Link>

        <h1
          style={{
            fontSize: 44,
            margin: "24px 0 8px",
          }}
        >
          Plans
        </h1>

        <p
          style={{
            opacity: 0.7,
            maxWidth: 650,
          }}
        >
          Simple limits keep ScholarAI
          sustainable while giving students
          meaningful access to the learning
          system.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
            marginTop: 30,
          }}
        >
          {plans.map((plan) => (
            <article
              key={plan.id}
              style={{
                padding: 22,
                border:
                  currentPlan === plan.id
                    ? "1px solid #a1a1aa"
                    : "1px solid #27272a",
                borderRadius: 18,
                background: "#111113",
                position: "relative",
              }}
            >
              {currentPlan === plan.id && (
                <span
                  style={{
                    position: "absolute",
                    top: 18,
                    right: 18,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "#d4d4d8",
                    border: "1px solid #3f3f46",
                    borderRadius: 999,
                    padding: "3px 9px",
                  }}
                >
                  Current plan
                </span>
              )}

              <h2>{plan.name}</h2>

              <div
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                }}
              >
                {plan.price}

                <span
                  style={{
                    fontSize: 14,
                    opacity: 0.6,
                  }}
                >
                  {plan.id === "FREE"
                    ? ""
                    : " / month"}
                </span>
              </div>

              <strong>{plan.limit}</strong>

              <ul
                style={{
                  lineHeight: 1.8,
                  paddingLeft: 20,
                }}
              >
                {plan.features.map(
                  (feature) => (
                    <li key={feature}>
                      {feature}
                    </li>
                  )
                )}
              </ul>

              {plan.id !== "FREE" && (
                <button
                  onClick={() =>
                    subscribe(plan.id)
                  }
                  disabled={
                    loadingPlan !== null
                  }
                  style={{
                    width: "100%",
                    padding: 12,
                    border: 0,
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor:
                      loadingPlan !== null
                        ? "wait"
                        : "pointer",
                    opacity:
                      loadingPlan !== null
                        ? 0.6
                        : 1,
                  }}
                >
                  {loadingPlan === plan.id
                    ? "Processing..."
                    : `Choose ${plan.name}`}
                </button>
              )}
            </article>
          ))}
        </div>

        {msg && (
          <p
            style={{
              marginTop: 20,
              color: "#fbbf24",
            }}
          >
            {msg}
          </p>
        )}

        <p
          style={{
            marginTop: 30,
            opacity: 0.55,
            fontSize: 13,
          }}
        >
          Final production pricing and usage
          are subject to your configured Gemini
          API tier and actual token consumption.
        </p>
      </div>
    </main>
  );
}