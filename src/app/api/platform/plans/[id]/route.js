import { NextResponse } from "next/server";
import { deletePlatformPlan, getPlatformPlanById, PLATFORM_ROLES, upsertPlatformPlan } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { id } = await params;
    const existing = await getPlatformPlanById(id);
    if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    const body = await request.json();
    const plan = await upsertPlatformPlan({ ...existing, ...body, id });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("Error updating platform plan:", error);
    return NextResponse.json({ error: "Failed to update platform plan" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { id } = await params;
    const deleted = await deletePlatformPlan(id);
    if (!deleted) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error.message === "Plan is in use" ? 409 : 500;
    return NextResponse.json({ error: error.message || "Failed to delete platform plan" }, { status });
  }
}
