"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminStats = Record<string, unknown>;

export default function Admin() {
  const [data, setData] =
    useState<AdminStats | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const response =
          await fetch("/api/admin/stats");

        const result =
          (await response.json()) as
            | AdminStats
            | { error?: string };

        if (!response.ok) {
          const message =
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "Failed to load admin statistics.";

          throw new Error(message);
        }

        setData(result as AdminStats);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load admin statistics."
        );
      }
    }

    loadStats();
  }, []);

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
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{ color: "#fff" }}
        >
          ← ScholarAI
        </Link>

        <h1>Admin</h1>

        {error && <p>{error}</p>}

        {data && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 20,
              background: "#111113",
              borderRadius: 16,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}