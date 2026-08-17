"use client";

import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      if (data.authenticated) {
        window.location.href = "/";
      } else {
        setMessage("Account created. Check your email to confirm the account.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="grid-background" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="auth-wrap">
        <a href="/" className="auth-back">
          ← ScholarAI
        </a>

        <form onSubmit={submit} className="auth-card">
          <div className="auth-mark">S</div>

          <h1 className="auth-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>

          <p className="auth-subtitle">
            Your learning workspace, powered by AI. No GitHub or third-party
            account needed — just an email and a password.
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`auth-tab${mode === "login" ? " auth-tab-active" : ""}`}
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Sign in
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`auth-tab${mode === "signup" ? " auth-tab-active" : ""}`}
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
            >
              Create account
            </button>
          </div>

          <label className="auth-field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={6}
              required
            />
          </label>

          <button disabled={loading} className="auth-submit">
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>

          {message && <p className="auth-message">{message}</p>}
        </form>
      </div>
    </main>
  );
}
