import { NextResponse } from "next/server";
import { createPlatformSubscriber, getPlatformSubscribers, PLATFORM_ROLES } from "@/lib/db/index.js";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

function validateSubscriber(body) {
  if (!String(body.name || "").trim()) return "Name is required";
  if (body.creditBalance !== undefined && Number(body.creditBalance) < 0) return "Credits cannot be negative";
  return null;
}

export async function GET() {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    return NextResponse.json({ subscribers: await getPlatformSubscribers() });
  } catch (error) {
    console.error("Error fetching platform subscribers:", error);
    return NextResponse.json({ error: "Failed to fetch platform subscribers" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const body = await request.json();
    const error = validateSubscriber(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const machineId = await getConsistentMachineId();
    const result = await createPlatformSubscriber(body, machineId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating platform subscriber:", error);
    return NextResponse.json({ error: "Failed to create platform subscriber" }, { status: 500 });
  }
}
