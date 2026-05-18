import crypto from "node:crypto";

function timestampNow() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function buildSignedContent(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function signRsaSha256(content, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(content, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyRsaSha256(content, signature, publicKey) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(content, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function buildCommonParams(config, notifyUrl, returnUrl) {
  return {
    app_id: config.appId,
    charset: "utf-8",
    method: "",
    notify_url: notifyUrl,
    return_url: returnUrl,
    sign_type: "RSA2",
    timestamp: timestampNow(),
    version: "1.0",
  };
}

export function buildAlipayPagePay(config, payload) {
  const params = buildCommonParams(config, payload.notifyUrl, payload.returnUrl);
  params.method = "alipay.trade.page.pay";
  params.biz_content = JSON.stringify({
    out_trade_no: payload.outTradeNo,
    product_code: config.productCode,
    subject: payload.subject,
    total_amount: (payload.amountCents / 100).toFixed(2),
    timeout_express: payload.timeoutExpress || "30m",
  });
  const signContent = buildSignedContent(params);
  params.sign = signRsaSha256(signContent, config.privateKey);
  const url = `${config.gateway}?${new URLSearchParams(params).toString()}`;
  return { url, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() };
}

function extractAlipayResponse(method, rawText) {
  const responseKey = `${method.replace(/\./g, "_")}_response`;
  const parsed = JSON.parse(rawText);
  return parsed[responseKey] || null;
}

export async function queryAlipayOrder(config, outTradeNo) {
  const params = buildCommonParams(config, "", "");
  params.method = "alipay.trade.query";
  params.biz_content = JSON.stringify({
    out_trade_no: outTradeNo,
    query_options: ["fund_bill_list"],
  });
  delete params.notify_url;
  delete params.return_url;
  const signContent = buildSignedContent(params);
  params.sign = signRsaSha256(signContent, config.privateKey);

  const response = await fetch(config.gateway, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams(params).toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`支付宝查单失败: HTTP ${response.status}`);
  }

  const result = extractAlipayResponse("alipay.trade.query", text);
  if (!result) throw new Error("支付宝查单响应无效");
  return result;
}

export function verifyAlipayNotify(config, params) {
  const signature = params.sign;
  if (!signature) return false;
  const signContent = buildSignedContent(
    Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== "sign" && key !== "sign_type"),
    ),
  );
  return verifyRsaSha256(signContent, signature, config.publicKey);
}
