import { NextResponse } from "next/server";
import { handleAlipayWebhook, handleWechatWebhook } from "@/lib/payments/index.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const provider = new URL(request.url).searchParams.get("provider") || (request.headers.get("wechatpay-serial") ? "wechat" : "alipay");

  try {
    if (provider === "alipay") {
      await handleAlipayWebhook({ request });
      return new Response("success", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (provider === "wechat") {
      await handleWechatWebhook({ request });
      return new Response(null, { status: 204 });
    }

    return NextResponse.json({ error: "Unknown payment provider" }, { status: 400 });
  } catch (error) {
    if (provider === "wechat") {
      return NextResponse.json({ code: "FAIL", message: error.message || "Webhook failed" }, { status: 400 });
    }
    return new Response("fail", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
