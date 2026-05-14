import { NextResponse } from "next/server";
import { createRedemptionCode, getRedemptionCodes, PLATFORM_ROLES } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

function validate(body) {
  if (!Number.isFinite(Number(body.credits || 0)) || Number(body.credits || 0) <= 0) return "Credits must be positive";
  if (body.maxRedemptions !== undefined && (!Number.isInteger(Number(body.maxRedemptions)) || Number(body.maxRedemptions) < 1)) {
    return "Max redemptions must be a positive integer";
  }
  if (body.expiresAt && Number.isNaN(new Date(body.expiresAt).getTime())) return "Invalid expiration time";
  return null;
}

export async function GET() {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    return NextResponse.json({ codes: await getRedemptionCodes() });
  } catch (error) {
    console.error("Error fetching redemption codes:", error);
    return NextResponse.json({ error: "Failed to fetch redemption codes" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { user, response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const body = await request.json();
    const error = validate(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const code = await createRedemptionCode({
      credits: Number(body.credits),
      maxRedemptions: body.maxRedemptions === undefined ? 1 : Number(body.maxRedemptions),
      expiresAt: body.expiresAt || null,
      createdByUserId: user.id,
      data: body.data || {},
    });
    return NextResponse.json({ code }, { status: 201 });
  } catch (error) {
    console.error("Error creating redemption code:", error);
    return NextResponse.json({ error: error.message || "Failed to create redemption code" }, { status: 500 });
  }
}
