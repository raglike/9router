import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  countPlatformUsers,
  createPlatformSubscriber,
  createPlatformUser,
  PLATFORM_ROLES,
  updatePlatformUser,
} from "@/lib/db/index.js";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession.js";
import { userSessionPayload } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const count = await countPlatformUsers();
    const role = count === 0 ? PLATFORM_ROLES.ROOT : PLATFORM_ROLES.USER;

    const user = await createPlatformUser({
      username: body.username,
      email: body.email,
      password: body.password,
      displayName: body.displayName || body.username,
      role,
      status: "active",
    });

    const { subscriber } = await createPlatformSubscriber({
      userId: user.id,
      name: user.displayName || user.username,
      email: user.email || "",
      creditBalance: 0,
      createApiKey: false,
    });

    const updated = await updatePlatformUser(user.id, { subscriberId: subscriber.id });
    const cookieStore = await cookies();
    await setDashboardAuthCookie(cookieStore, request, userSessionPayload(updated));

    return NextResponse.json({ success: true, user: updated }, { status: 201 });
  } catch (error) {
    const message = error.message || "Failed to register";
    const status = message.includes("已存在") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
