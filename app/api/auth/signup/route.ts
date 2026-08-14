import { NextResponse } from "next/server";
import { supabaseAuth, setAccessToken } from "@/lib/supabase-rest";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const data = await supabaseAuth("signup", { email, password });
    if (data.access_token) await setAccessToken(data.access_token);
    return NextResponse.json({ user: data.user, authenticated: Boolean(data.access_token), needsConfirmation: !data.access_token });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign up failed." }, { status: 400 }); }
}
