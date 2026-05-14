import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDashboardAuthSession } from "./dashboardSession.js";
import { getPlatformUserById, getUserPermissions, hasRole, PLATFORM_ROLES } from "@/lib/db/index.js";

export async function getCurrentPlatformUser() {
  const cookieStore = await cookies();
  const session = await getDashboardAuthSession(cookieStore.get("auth_token")?.value);
  if (!session?.userId) return null;

  const user = await getPlatformUserById(session.userId);
  if (!user || user.status !== "active") return null;
  return user;
}

export async function requirePlatformUser(minRole = PLATFORM_ROLES.USER) {
  const user = await getCurrentPlatformUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!hasRole(user, minRole)) {
    return { user: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, response: null };
}

export function userSessionPayload(user) {
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    subscriberId: user.subscriberId || null,
  };
}

export function publicUserPayload(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email || "",
    displayName: user.displayName || user.username,
    role: user.role,
    status: user.status,
    subscriberId: user.subscriberId || null,
    permissions: getUserPermissions(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
