import { NextResponse } from "next/server";
import { getCurrentUser, getUsage } from "@/lib/usage";
export const runtime = "nodejs";
export async function GET() { const user = await getCurrentUser(); if (!user) return NextResponse.json({ authenticated: false }); return NextResponse.json({ authenticated: true, user: { id: user.id, email: user.email }, usage: await getUsage(user.id) }); }
