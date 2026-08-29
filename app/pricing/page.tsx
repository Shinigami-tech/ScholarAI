"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { Check, FlaskConical, LogIn, UserRound } from "lucide-react";

type Plan = {
  id: "FREE" | "PRO" | "PREMIUM";
  name: string;
  price: string;
  limit: string;
  features: string[];
};

type CheckoutResponse = {
  transactionId?: string;
  error?: string;
};

declare global {
  interface Window {
    Paddle?: {
      Environment: { set: (env: string) => void };
      Setup: (opts: { token: string }) => void;
      Checkout: { open: (opts: Record<string, unknown>) => void };
    };
  }
}

const plans: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    limit: "20 units/day",
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
    limit: "75 units/day",
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
    limit: "200 units/day",
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
  const [authenticated, setAuthenticated] = useState(false);
  const [paddleReady, setPaddleReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        setAuthenticated(Boolean(data?.authenticated));
        if (data?.authenticated && data?.usage?.plan) {
          setCurrentPlan(data.usage.plan);
        }
      })
      .catch(() => {});
  }, []);

  function initPaddle() {
    if (!window.Paddle) return;
    const env =
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
        ? "production"
        : "sandbox";
    window.Paddle.Environment.set(env);
    window.Paddle.Setup({
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
    });
    setPaddleReady(true);
  }

  async function subscribe(plan: Plan["id"]) {
    setMsg("");
    setLoadingPlan(plan);

    try {
      if (!window.Paddle || !paddleReady) {
        throw new Error(
          "Checkout is still loading, try again in a moment."
        );
      }

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

      if (!data.transactionId) {
        throw new Error(
          "Checkout transaction was not created."
        );
      }

      window.Paddle.Checkout.open({
        transactionId: data.transactionId,
      });
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
    <main className="app-shell">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={initPaddle}
      />
      <div className="grid-background" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">✦</div>
          <div>
            <div className="brand-name">
              Scholar
              <span>AI</span>
            </div>
            <div className="brand-caption">Plans</div>
          </div>
        </div>
        <div className="topbar-actions">
          <a href="/tools" className="nav-link">
            <FlaskConical size={15} />
            <span>Learning Lab</span>
          </a>
          {authenticated ? (
            <a href="/account" className="nav-link">
              <UserRound size={15} />
              <span>Account</span>
            </a>
          ) : (
            <a href="/login" className="nav-link">
              <LogIn size={15} />
              <span>Sign in</span>
            </a>
          )}
          <a href="/" className="nav-link">
            ← ScholarAI
          </a>
        </div>
      </header>

      <section className="plans-hero">
        <h1>Plans</h1>
        <p>
          Simple limits keep ScholarAI sustainable while giving students
          meaningful access to the learning system.
        </p>
      </section>

      <section className="plans-grid">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`plan-card ${
              currentPlan === plan.id ? "plan-card-current" : ""
            }`}
          >
            {currentPlan === plan.id && (
              <span className="plan-current-badge">Current plan</span>
            )}

            <h2 className="plan-name">{plan.name}</h2>

            <div className="plan-price">
              {plan.price}
              <span>{plan.id === "FREE" ? "" : "/ month"}</span>
            </div>

            <span className="plan-limit">{plan.limit}</span>

            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} strokeWidth={2.6} />
                  {feature}
                </li>
              ))}
            </ul>

            {plan.id === "FREE" ? (
              <button className="plan-cta-outline" disabled>
                {currentPlan === "FREE" || !currentPlan
                  ? "Included"
                  : "Free tier"}
              </button>
            ) : (
              <button
                className="plan-cta"
                onClick={() => subscribe(plan.id)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === plan.id
                  ? "Processing..."
                  : `Choose ${plan.name}`}
              </button>
            )}
          </article>
        ))}
      </section>

      {msg && (
        <div className="plans-error-wrap">
          <div className="plans-error">{msg}</div>
        </div>
      )}

      <p className="plans-note">
        Final production pricing and usage are subject to your configured
        Gemini API tier and actual token consumption.
      </p>
    </main>
  );
}
