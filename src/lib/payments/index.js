import crypto from "node:crypto";
import {
  createPlatformPaymentOrder,
  getPlatformPaymentOrderById,
  getPlatformPaymentOrderByOutTradeNo,
  getPlatformPlanById,
  getPlatformSubscriberById,
  listPlatformPaymentOrders,
  settlePlatformPaymentOrder,
  updatePlatformPaymentOrder,
} from "@/lib/db/index.js";
import { buildAlipayPagePay, queryAlipayOrder, verifyAlipayNotify } from "./alipay.js";
import { getPaymentConfig, getPublicPaymentProviders } from "./config.js";
import {
  createWechatNativeOrder,
  decryptWechatResource,
  queryWechatOrder,
  verifyWechatCallback,
} from "./wechat.js";

function buildTradeNo() {
  return `NR${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function paymentSubject(plan) {
  return `9Router ${plan.name} 订阅`;
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

export function toPublicPaymentOrder(order) {
  if (!order) return null;
  const checkout = order.status === "pending" ? (order.meta?.checkout || null) : null;
  return {
    id: order.id,
    planId: order.planId,
    planName: order.planName,
    provider: order.provider,
    channel: order.channel,
    outTradeNo: order.outTradeNo,
    amountCents: order.amountCents,
    currency: order.currency,
    status: order.status,
    subject: order.subject,
    creditsGranted: order.creditsGranted,
    providerTradeNo: order.providerTradeNo,
    lastCheckedAt: order.lastCheckedAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    settledAt: order.settledAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    checkout,
  };
}

export function getPaymentRuntime(request) {
  const config = getPaymentConfig(request);
  return {
    config,
    providers: getPublicPaymentProviders(config),
    paymentEnabled: config.alipay.enabled || config.wechat.enabled,
  };
}

export async function listOrdersForUser(user) {
  const orders = await listPlatformPaymentOrders({
    userId: user.id,
    subscriberId: user.subscriberId || undefined,
    limit: 30,
  });
  return orders.map(toPublicPaymentOrder);
}

export async function createPaymentOrderForUser({ request, user, planId, provider }) {
  const runtime = getPaymentRuntime(request);
  const plan = await getPlatformPlanById(planId);
  if (!plan || !plan.isActive) throw new Error("套餐不可用");
  if (!user.subscriberId) throw new Error("当前账户未绑定订阅者，无法发起支付");
  if (Number(plan.priceCents || 0) <= 0) throw new Error("当前套餐无需支付");

  const channel = provider === "alipay" ? "alipay_page" : provider === "wechat" ? "wechat_native" : "";
  if (!channel) throw new Error("不支持的支付渠道");
  if (!runtime.providers[provider]?.enabled) throw new Error(runtime.providers[provider]?.reason || "支付方式未启用");

  const outTradeNo = buildTradeNo();
  const notifyUrl = `${runtime.config.notifyBaseUrl}/api/platform/payments/webhook?provider=${encodeURIComponent(provider)}`;
  const returnUrl = `${runtime.config.returnBaseUrl}/dashboard/platform?tab=wallet`;
  const subject = paymentSubject(plan);
  let checkout = null;
  let expiresAt = null;

  if (provider === "alipay") {
    const result = buildAlipayPagePay(runtime.config.alipay, {
      outTradeNo,
      amountCents: plan.priceCents,
      notifyUrl,
      returnUrl,
      subject,
    });
    checkout = { type: "redirect", url: result.url };
    expiresAt = result.expiresAt;
  } else if (provider === "wechat") {
    const result = await createWechatNativeOrder(runtime.config.wechat, {
      outTradeNo,
      amountCents: plan.priceCents,
      currency: plan.currency || "CNY",
      notifyUrl,
      subject,
      attach: JSON.stringify({ planId: plan.id, userId: user.id }),
      clientIp: getClientIp(request),
    });
    checkout = { type: "qr", codeUrl: result.codeUrl };
    expiresAt = result.expiresAt;
  }

  const created = await createPlatformPaymentOrder({
    userId: user.id,
    subscriberId: user.subscriberId,
    planId: plan.id,
    provider,
    channel,
    outTradeNo,
    amountCents: plan.priceCents,
    currency: plan.currency || "CNY",
    status: "pending",
    subject,
    expiresAt,
    meta: { checkout },
  });

  return {
    runtime,
    order: await getPlatformPaymentOrderById(created.id),
    action: checkout,
  };
}

export async function refreshPaymentOrderById(id) {
  const order = await getPlatformPaymentOrderById(id);
  if (!order) throw new Error("订单不存在");
  if (order.status === "paid") return order;

  const runtime = getPaymentRuntime();
  if (order.provider === "alipay") {
    const result = await queryAlipayOrder(runtime.config.alipay, order.outTradeNo);
    const tradeStatus = result.trade_status || "";
    if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
      return settlePlatformPaymentOrder(order.id, {
        providerTradeNo: result.trade_no,
        paidAt: result.send_pay_date ? new Date(result.send_pay_date.replace(/-/g, "/")).toISOString() : new Date().toISOString(),
        meta: { queryResult: result },
      });
    }
    return updatePlatformPaymentOrder(order.id, {
      status: tradeStatus === "TRADE_CLOSED" ? "closed" : "pending",
      lastCheckedAt: new Date().toISOString(),
      meta: { queryResult: result },
    });
  }

  if (order.provider === "wechat") {
    const result = await queryWechatOrder(runtime.config.wechat, order.outTradeNo);
    const tradeState = result.trade_state || "";
    if (tradeState === "SUCCESS") {
      return settlePlatformPaymentOrder(order.id, {
        providerTradeNo: result.transaction_id,
        paidAt: result.success_time || new Date().toISOString(),
        meta: { queryResult: result },
      });
    }
    return updatePlatformPaymentOrder(order.id, {
      status: tradeState === "CLOSED" || tradeState === "REVOKED" ? "closed" : tradeState === "PAYERROR" ? "failed" : "pending",
      lastCheckedAt: new Date().toISOString(),
      meta: { queryResult: result },
    });
  }

  throw new Error("不支持的支付提供方");
}

export async function handleAlipayWebhook({ request }) {
  const runtime = getPaymentRuntime(request);
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body).entries());
  const order = await getPlatformPaymentOrderByOutTradeNo(params.out_trade_no);
  if (!order) throw new Error("订单不存在");
  if (!verifyAlipayNotify(runtime.config.alipay, params)) throw new Error("支付宝回调验签失败");
  if (params.app_id && params.app_id !== runtime.config.alipay.appId) throw new Error("支付宝 APPID 不匹配");
  if (runtime.config.alipay.sellerId && params.seller_id && params.seller_id !== runtime.config.alipay.sellerId) {
    throw new Error("支付宝卖家 PID 不匹配");
  }
  if ((params.trade_status === "TRADE_SUCCESS" || params.trade_status === "TRADE_FINISHED")
    && Number(params.total_amount || 0).toFixed(2) === (order.amountCents / 100).toFixed(2)) {
    await settlePlatformPaymentOrder(order.id, {
      providerTradeNo: params.trade_no,
      paidAt: params.gmt_payment ? new Date(params.gmt_payment.replace(/-/g, "/")).toISOString() : new Date().toISOString(),
      meta: { notifyResult: params },
    });
  } else {
    await updatePlatformPaymentOrder(order.id, {
      status: params.trade_status === "TRADE_CLOSED" ? "closed" : "pending",
      lastCheckedAt: new Date().toISOString(),
      meta: { notifyResult: params },
    });
  }
}

export async function handleWechatWebhook({ request }) {
  const runtime = getPaymentRuntime(request);
  const body = await request.text();
  if (!verifyWechatCallback(runtime.config.wechat, request.headers, body)) {
    throw new Error("微信支付回调验签失败");
  }
  const payload = JSON.parse(body);
  const resource = decryptWechatResource(runtime.config.wechat, payload.resource);
  const order = await getPlatformPaymentOrderByOutTradeNo(resource.out_trade_no);
  if (!order) throw new Error("订单不存在");
  if (Number(resource.amount?.total || 0) !== Number(order.amountCents || 0)) {
    throw new Error("微信支付金额校验失败");
  }
  if (resource.trade_state === "SUCCESS") {
    await settlePlatformPaymentOrder(order.id, {
      providerTradeNo: resource.transaction_id,
      paidAt: resource.success_time || new Date().toISOString(),
      meta: {
        notifyId: payload.id,
        notifyResult: resource,
      },
    });
    return;
  }
  await updatePlatformPaymentOrder(order.id, {
    status: resource.trade_state === "CLOSED" || resource.trade_state === "REVOKED" ? "closed" : resource.trade_state === "PAYERROR" ? "failed" : "pending",
    lastCheckedAt: new Date().toISOString(),
    meta: {
      notifyId: payload.id,
      notifyResult: resource,
    },
  });
}
