import { NextResponse } from "next/server";
import { supabaseAuth, setAccessToken } from "@/lib/supabase-rest";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const data = await supabaseAuth("token?grant_type=password", { email, password });
    await setAccessToken(data.access_token);
    return NextResponse.json({ user: data.user, authenticated: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sign in failed." }, { status: 401 }); }
}
