import { NextResponse } from "next/server";
import {
  getPlatformLedger,
  getPlatformOverview,
  getPlatformPlans,
  getPlatformSubscriberById,
} from "@/lib/db/index.js";
import { publicUserPayload, requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requirePlatformUser();
  if (response) return response;

  const [subscriber, overview, ledger, plans] = await Promise.all([
    user.subscriberId ? getPlatformSubscriberById(user.subscriberId) : null,
    getPlatformOverview({ subscriberId: user.subscriberId }),
    getPlatformLedger({ subscriberId: user.subscriberId, limit: 100 }),
    getPlatformPlans({ includeInactive: false }),
  ]);

  return NextResponse.json({
    user: publicUserPayload(user),
    subscriber,
    overview,
    ledger,
    plans,
  });
}
