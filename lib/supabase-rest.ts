import { cookies } from "next/headers";

const ACCESS_COOKIE = "scholarai_access_token";

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function getSupabaseConfig() {
  return {
    url: env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
    anon: env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRole: env("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export async function setAccessToken(token: string) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAccessToken() {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
}

export async function getAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value || null;
}

export async function supabaseAuth(path: string, body: unknown, accessToken?: string | null) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: config.anon,
      Authorization: `Bearer ${accessToken || config.anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.msg || data?.error_description || data?.message || "Supabase authentication failed.");
  return data;
}

export async function getSupabaseUser(accessToken?: string | null) {
  const token = accessToken ?? (await getAccessToken());
  if (!token) return null;
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

export async function adminRest(path: string, options: { method?: string; body?: unknown; query?: string } = {}) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}${options.query ? `?${options.query}` : ""}`, {
    method: options.method || "GET",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || "Supabase database request failed.");
  return data;
}
