import { NextResponse } from "next/server";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";
import { createPaymentOrderForUser, getPaymentRuntime, listOrdersForUser, toPublicPaymentOrder } from "@/lib/payments/index.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, response } = await requirePlatformUser();
  if (response) return response;
  const runtime = getPaymentRuntime();
  const orders = await listOrdersForUser(user);
  return NextResponse.json({
    orders,
    paymentEnabled: runtime.paymentEnabled,
    providers: runtime.providers,
  });
}

export async function POST(request) {
  const { user, response } = await requirePlatformUser();
  if (response) return response;
  try {
    const body = await request.json();
    const { runtime, order, action } = await createPaymentOrderForUser({
      request,
      user,
      planId: body.planId,
      provider: body.provider,
    });
    return NextResponse.json({
      order: toPublicPaymentOrder(order),
      action,
      paymentEnabled: runtime.paymentEnabled,
      providers: runtime.providers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "创建支付订单失败", paymentEnabled: false },
      { status: 400 },
    );
  }
}
