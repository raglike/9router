import { NextResponse } from "next/server";
import { getCurrentPlatformUser, publicUserPayload, requirePlatformUser } from "@/lib/auth/platformSession.js";
import { updatePlatformUser } from "@/lib/db/index.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentPlatformUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ user: publicUserPayload(user) });
}

export async function PATCH(request) {
  const { user, response } = await requirePlatformUser();
  if (response) return response;

  const body = await request.json();
  const updates = {
    displayName: body.displayName,
    email: body.email,
  };
  if (body.password) updates.password = body.password;

  const updated = await updatePlatformUser(user.id, updates);
  return NextResponse.json({ user: publicUserPayload(updated) });
}
