import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { setDashboardAuthCookie } from "@/lib/auth/dashboardSession";
import { isOidcConfigured } from "@/lib/auth/oidc";
import { countPlatformUsers, validatePlatformUserCredentials } from "@/lib/db/index.js";
import { userSessionPayload } from "@/lib/auth/platformSession.js";

function isTunnelRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const settings = await getSettings();

    // Block login via tunnel/tailscale if dashboard access is disabled
    if (isTunnelRequest(request, settings) && settings.tunnelDashboardAccess !== true) {
      return NextResponse.json({ error: "Dashboard access via tunnel is disabled" }, { status: 403 });
    }

    if (settings.authMode === "oidc" && isOidcConfigured(settings)) {
      return NextResponse.json({ error: "Password login is disabled. Use OIDC sign in." }, { status: 403 });
    }

    const userCount = await countPlatformUsers();
    if (userCount > 0) {
      if (!username || !password) {
        return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
      }

      const user = await validatePlatformUserCredentials(username, password);
      if (!user) return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, userSessionPayload(user));
      return NextResponse.json({ success: true, user });
    }

    // Backward-compatible bootstrap login before the first platform user is registered.
    const storedHash = settings.password;
    const initialPassword = process.env.INITIAL_PASSWORD || "123456";
    const isValid = storedHash ? await bcrypt.compare(password, storedHash) : password === initialPassword;
    if (isValid) {
      const cookieStore = await cookies();
      await setDashboardAuthCookie(cookieStore, request, { role: "root", bootstrap: true });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
