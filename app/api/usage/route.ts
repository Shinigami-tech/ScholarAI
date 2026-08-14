import { NextResponse } from "next/server";
import { requireUserForApi, getUsage } from "@/lib/usage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json(await getUsage(user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Usage service failed." }, { status: 500 });
  }
}
