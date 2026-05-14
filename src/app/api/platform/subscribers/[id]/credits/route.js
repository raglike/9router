import { NextResponse } from "next/server";
import { adjustPlatformCredits, PLATFORM_ROLES } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { id } = await params;
    const body = await request.json();
    const amount = Number(body.amount || 0);
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "Amount must be a non-zero number" }, { status: 400 });
    }

    const subscriber = await adjustPlatformCredits(id, amount, body.description || "手动调整");
    return NextResponse.json({ subscriber });
  } catch (error) {
    const status = error.message === "Subscriber not found" ? 404 : 500;
    return NextResponse.json({ error: error.message || "Failed to adjust credits" }, { status });
  }
}
