import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";
import { hasRole, PLATFORM_ROLES, getPlatformPaymentOrderById } from "@/lib/db/index.js";
import { refreshPaymentOrderById, toPublicPaymentOrder } from "@/lib/payments/index.js";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const { user, response } = await requirePlatformUser();
  if (response) return response;

  const order = await getPlatformPaymentOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (!hasRole(user, PLATFORM_ROLES.ADMIN) && order.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const refreshed = await refreshPaymentOrderById(order.id);
    return NextResponse.json({ order: toPublicPaymentOrder(refreshed) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "刷新支付状态失败" }, { status: 400 });
  }
}
