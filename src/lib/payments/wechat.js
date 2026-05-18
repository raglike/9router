import crypto from "node:crypto";

function randomString(size = 32) {
  return crypto.randomBytes(Math.ceil(size / 2)).toString("hex").slice(0, size);
}

function signMessage(message, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message, "utf8");
  signer.end();
  return signer.sign(privateKey, "base64");
}

function verifyMessage(message, signature, publicKey) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(message, "utf8");
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

function buildAuthorization(config, method, pathnameWithQuery, body = "") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomString(32);
  const message = `${method}\n${pathnameWithQuery}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signMessage(message, config.privateKey);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchid}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${config.serialNo}",signature="${signature}"`;
}

async function wechatRequest(config, method, pathnameWithQuery, body) {
  const response = await fetch(`${config.gateway}${pathnameWithQuery}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: buildAuthorization(config, method, pathnameWithQuery, body || ""),
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`微信支付请求失败: HTTP ${response.status} ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function createWechatNativeOrder(config, payload) {
  const body = JSON.stringify({
    appid: config.appId,
    mchid: config.mchid,
    description: payload.subject,
    out_trade_no: payload.outTradeNo,
    notify_url: payload.notifyUrl,
    attach: payload.attach || "",
    amount: {
      total: payload.amountCents,
      currency: payload.currency || "CNY",
    },
    scene_info: {
      payer_client_ip: payload.clientIp,
    },
  });
  const result = await wechatRequest(config, "POST", "/v3/pay/transactions/native", body);
  return {
    codeUrl: result.code_url,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    raw: result,
  };
}

export async function queryWechatOrder(config, outTradeNo) {
  const pathname = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(config.mchid)}`;
  return wechatRequest(config, "GET", pathname, "");
}

export function verifyWechatCallback(config, headers, body) {
  const signature = headers.get("wechatpay-signature");
  const timestamp = headers.get("wechatpay-timestamp");
  const nonce = headers.get("wechatpay-nonce");
  const serial = headers.get("wechatpay-serial");
  if (!signature || !timestamp || !nonce || !serial) {
    throw new Error("微信支付回调缺少验签头");
  }
  if (signature.startsWith("WECHATPAY/SIGNTEST/")) {
    throw new Error("微信支付签名探测流量");
  }
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  if (config.publicKeyId && config.publicKey && serial === config.publicKeyId) {
    return verifyMessage(message, signature, config.publicKey);
  }
  if (config.platformCertSerial && config.platformCert && serial === config.platformCertSerial) {
    return verifyMessage(message, signature, config.platformCert);
  }
  throw new Error(`未匹配到微信支付验签序列号: ${serial}`);
}

export function decryptWechatResource(config, resource) {
  const key = Buffer.from(config.apiV3Key, "utf8");
  const nonce = Buffer.from(resource.nonce, "utf8");
  const associatedData = Buffer.from(resource.associated_data || "", "utf8");
  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(associatedData);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
