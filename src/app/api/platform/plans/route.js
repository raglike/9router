import { NextResponse } from "next/server";
import { getPlatformPlans, PLATFORM_ROLES, upsertPlatformPlan } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

function validatePlan(body) {
  const name = String(body.name || "").trim();
  if (!name) return "Name is required";
  if (Number(body.priceCents || 0) < 0) return "Price cannot be negative";
  if (Number(body.monthlyCredits || 0) < 0) return "Credits cannot be negative";
  if (Number(body.maxRequestsPerDay || 0) < 0) return "Request limit cannot be negative";
  return null;
}

export async function GET() {
  try {
    const { response } = await requirePlatformUser();
    if (response) return response;
    return NextResponse.json({ plans: await getPlatformPlans() });
  } catch (error) {
    console.error("Error fetching platform plans:", error);
    return NextResponse.json({ error: "Failed to fetch platform plans" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const body = await request.json();
    const error = validatePlan(body);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const plan = await upsertPlatformPlan({ ...body, currency: body.currency || "CNY" });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error("Error creating platform plan:", error);
    return NextResponse.json({ error: "Failed to create platform plan" }, { status: 500 });
  }
}
