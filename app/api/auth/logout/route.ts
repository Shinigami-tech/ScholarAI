import { NextResponse } from "next/server";
import { clearAccessToken } from "@/lib/supabase-rest";
export async function POST() { await clearAccessToken(); return NextResponse.json({ ok: true }); }
