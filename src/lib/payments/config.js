function readEnv(key) {
  const value = process.env[key];
  return value ? String(value).trim() : "";
}

function decodePem(value) {
  return value ? value.replace(/\\n/g, "\n").trim() : "";
}

function hasHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function withTrailingSlashTrimmed(value) {
  return value.replace(/\/+$/, "");
}

function buildBaseUrl(...candidates) {
  const matched = candidates.map((item) => String(item || "").trim()).find((item) => hasHttpUrl(item));
  return matched ? withTrailingSlashTrimmed(matched) : "";
}

export function getPaymentConfig(request) {
  const requestOrigin = request ? new URL(request.url).origin : "";
  const notifyBaseUrl = buildBaseUrl(
    readEnv("PLATFORM_PAYMENT_NOTIFY_BASE_URL"),
    readEnv("BASE_URL"),
    readEnv("NEXT_PUBLIC_BASE_URL"),
    requestOrigin,
  );
  const returnBaseUrl = buildBaseUrl(
    readEnv("PLATFORM_PAYMENT_RETURN_URL"),
    notifyBaseUrl,
  );

  const alipay = {
    appId: readEnv("ALIPAY_APP_ID"),
    privateKey: decodePem(readEnv("ALIPAY_PRIVATE_KEY")),
    publicKey: decodePem(readEnv("ALIPAY_PUBLIC_KEY")),
    sellerId: readEnv("ALIPAY_SELLER_ID"),
    gateway: readEnv("ALIPAY_GATEWAY") || "https://openapi.alipay.com/gateway.do",
    productCode: readEnv("ALIPAY_PAGE_PRODUCT_CODE") || "FAST_INSTANT_TRADE_PAY",
  };

  const wechat = {
    appId: readEnv("WECHAT_PAY_APPID"),
    mchid: readEnv("WECHAT_PAY_MCHID"),
    serialNo: readEnv("WECHAT_PAY_SERIAL_NO"),
    privateKey: decodePem(readEnv("WECHAT_PAY_PRIVATE_KEY")),
    apiV3Key: readEnv("WECHAT_PAY_API_V3_KEY"),
    publicKeyId: readEnv("WECHAT_PAY_PUBLIC_KEY_ID"),
    publicKey: decodePem(readEnv("WECHAT_PAY_PUBLIC_KEY")),
    platformCertSerial: readEnv("WECHAT_PAY_PLATFORM_CERT_SERIAL"),
    platformCert: decodePem(readEnv("WECHAT_PAY_PLATFORM_CERT")),
    gateway: readEnv("WECHAT_PAY_GATEWAY") || "https://api.mch.weixin.qq.com",
  };

  const alipayEnabled = Boolean(notifyBaseUrl && returnBaseUrl && alipay.appId && alipay.privateKey && alipay.publicKey);
  const wechatEnabled = Boolean(
    notifyBaseUrl
      && wechat.appId
      && wechat.mchid
      && wechat.serialNo
      && wechat.privateKey
      && wechat.apiV3Key
      && ((wechat.publicKeyId && wechat.publicKey) || (wechat.platformCertSerial && wechat.platformCert)),
  );

  return {
    notifyBaseUrl,
    returnBaseUrl,
    alipay: {
      ...alipay,
      enabled: alipayEnabled,
      reason: alipayEnabled ? "" : "缺少支付宝 APPID / RSA 密钥 / 公网回调地址配置",
    },
    wechat: {
      ...wechat,
      enabled: wechatEnabled,
      reason: wechatEnabled ? "" : "缺少微信商户号 / APIv3 密钥 / 商户私钥 / 验签公钥或平台证书 / 公网回调地址配置",
    },
  };
}

export function getPublicPaymentProviders(config) {
  return {
    alipay: {
      key: "alipay",
      label: "支付宝",
      channel: "电脑网站支付",
      enabled: config.alipay.enabled,
      reason: config.alipay.reason,
    },
    wechat: {
      key: "wechat",
      label: "微信支付",
      channel: "Native 扫码支付",
      enabled: config.wechat.enabled,
      reason: config.wechat.reason,
    },
  };
}
