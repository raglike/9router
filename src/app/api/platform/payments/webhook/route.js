import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Payment webhook is reserved but not enabled" },
    { status: 501 },
  );
}
