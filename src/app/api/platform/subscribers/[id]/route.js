import { NextResponse } from "next/server";
import {
  createSubscriberApiKey,
  deletePlatformSubscriber,
  getPlatformSubscriberById,
  hasRole,
  PLATFORM_ROLES,
  updatePlatformSubscriber,
} from "@/lib/db/index.js";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { id } = await params;
    const existing = await getPlatformSubscriberById(id);
    if (!existing) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });

    const body = await request.json();
    const subscriber = await updatePlatformSubscriber(id, body);
    return NextResponse.json({ subscriber });
  } catch (error) {
    console.error("Error updating platform subscriber:", error);
    return NextResponse.json({ error: "Failed to update platform subscriber" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { user, response } = await requirePlatformUser();
    if (response) return response;
    const { id } = await params;
    const existing = await getPlatformSubscriberById(id);
    if (!existing) return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    if (!hasRole(user, PLATFORM_ROLES.ADMIN) && user.subscriberId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const machineId = await getConsistentMachineId();
    const apiKey = await createSubscriberApiKey(id, body.name || `${existing.name} API Key`, machineId);
    return NextResponse.json({ apiKey }, { status: 201 });
  } catch (error) {
    console.error("Error creating subscriber API key:", error);
    return NextResponse.json({ error: "Failed to create subscriber API key" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { id } = await params;
    await deletePlatformSubscriber(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting platform subscriber:", error);
    return NextResponse.json({ error: "Failed to delete platform subscriber" }, { status: 500 });
  }
}
