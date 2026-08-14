"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
  usage?: {
    plan: string;
    remaining: number;
  };
};

type BillingPortalResponse = {
  url?: string;
  error?: string;
};

export default function Account() {
  const [me, setMe] =
    useState<MeResponse | null>(null);

  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function loadAccount() {
      try {
        const response =
          await fetch("/api/auth/me");

        const data =
          (await response.json()) as MeResponse;

        setMe(data);
      } catch {
        setMe(null);
      }
    }

    loadAccount();
  }, []);

  async function portal() {
    setMsg("");

    try {
      const response =
        await fetch("/api/billing-portal", {
          method: "POST",
        });

      const data =
        (await response.json()) as BillingPortalResponse;

      if (!response.ok) {
        setMsg(
          data.error ||
            "Unable to open billing portal."
        );
        return;
      }

      if (!data.url) {
        setMsg(
          "Billing portal URL was not returned."
        );
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
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
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{ color: "#fff" }}
        >
          ← ScholarAI
        </Link>

        <h1>Account</h1>

        {me?.authenticated &&
        me.user &&
        me.usage ? (
          <>
            <p>{me.user.email}</p>

            <div
              style={{
                padding: 20,
                border: "1px solid #27272a",
                borderRadius: 16,
                background: "#111113",
              }}
            >
              <strong>
                {me.usage.plan}
              </strong>

              <p>
                {me.usage.remaining} units
                remaining today
              </p>

              <button
                onClick={portal}
                style={{
                  padding: 12,
                  border: 0,
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Manage billing
              </button>
            </div>
          </>
        ) : (
          <p>
            Not signed in.{" "}
            <Link
              href="/login"
              style={{ color: "#fff" }}
            >
              Sign in
            </Link>
            .
          </p>
        )}

        {msg && (
          <p
            style={{
              color: "#fbbf24",
            }}
          >
            {msg}
          </p>
        )}
      </div>
    </main>
  );
}