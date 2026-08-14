import { NextResponse } from "next/server";
import { getCurrentUser, getUsage } from "@/lib/usage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ authenticated: false });
    const usage = await getUsage(user.id);
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      usage,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load user." }, { status: 500 });
  }
}
