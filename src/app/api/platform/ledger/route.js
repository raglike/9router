import { NextResponse } from "next/server";
import { getPlatformLedger, hasRole, PLATFORM_ROLES } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { user, response } = await requirePlatformUser();
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 200);
    const subscriberId = hasRole(user, PLATFORM_ROLES.ADMIN)
      ? searchParams.get("subscriberId") || undefined
      : user.subscriberId;
    return NextResponse.json({ ledger: await getPlatformLedger({ limit, subscriberId }) });
  } catch (error) {
    console.error("Error fetching platform ledger:", error);
    return NextResponse.json({ error: "Failed to fetch platform ledger" }, { status: 500 });
  }
}
