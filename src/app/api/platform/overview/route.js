import { NextResponse } from "next/server";
import { getPlatformOverview, hasRole, PLATFORM_ROLES } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user, response } = await requirePlatformUser();
    if (response) return response;
    const subscriberId = hasRole(user, PLATFORM_ROLES.ADMIN) ? undefined : user.subscriberId;
    return NextResponse.json(await getPlatformOverview({ subscriberId }));
  } catch (error) {
    console.error("Error fetching platform overview:", error);
    return NextResponse.json({ error: "Failed to fetch platform overview" }, { status: 500 });
  }
}
