import { NextResponse } from "next/server";
import { getPlatformSubscriberById, redeemPlatformCode } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { user, response } = await requirePlatformUser();
    if (response) return response;
    if (!user.subscriberId) {
      return NextResponse.json({ error: "Subscriber is required" }, { status: 400 });
    }

    const subscriber = await getPlatformSubscriberById(user.subscriberId);
    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    const body = await request.json();
    const result = await redeemPlatformCode({ code: body.code, subscriberId: subscriber.id, userId: user.id });
    return NextResponse.json({ redeemed: result });
  } catch (error) {
    const message = error.message || "Failed to redeem code";
    const status = ["Invalid redemption code", "Redemption code is not active", "Redemption code has expired", "Redemption code has been fully used", "Redemption code already used", "Redemption code must be at least 30 characters"].includes(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
