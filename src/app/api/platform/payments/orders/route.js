import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requirePlatformUser();
  if (response) return response;
  return NextResponse.json({ orders: [], paymentEnabled: false });
}

export async function POST() {
  const { response } = await requirePlatformUser();
  if (response) return response;
  return NextResponse.json(
    { error: "在线支付暂未启用，请联系管理员手动发放积分", paymentEnabled: false },
    { status: 501 },
  );
}
