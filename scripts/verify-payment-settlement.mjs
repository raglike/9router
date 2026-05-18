import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-payment-verify-"));
process.env.DATA_DIR = dataDir;
global._dbAdapter = { instance: null, initPromise: null, logged: true };

try {
  const {
    createPlatformPaymentOrder,
    createPlatformSubscriber,
    getPlatformLedger,
    getPlatformSubscriberById,
    settlePlatformPaymentOrder,
    upsertPlatformPlan,
  } = await import("../src/lib/db/index.js");

  const plan = await upsertPlatformPlan({
    id: "verify-pro",
    name: "Verify Pro",
    description: "Payment settlement verification plan",
    priceCents: 4900,
    currency: "CNY",
    monthlyCredits: 70000,
    maxRequestsPerDay: 5000,
    isActive: true,
    sortOrder: 1,
  });

  const { subscriber } = await createPlatformSubscriber({
    userId: "verify-user",
    name: "Verify User",
    email: "verify@example.com",
    creditBalance: 100,
    createApiKey: false,
  });

  const order = await createPlatformPaymentOrder({
    userId: "verify-user",
    subscriberId: subscriber.id,
    planId: plan.id,
    provider: "alipay",
    channel: "alipay_page",
    outTradeNo: "NRVERIFY001",
    amountCents: plan.priceCents,
    currency: plan.currency,
    status: "pending",
    subject: "9Router Verify Pro",
    meta: {},
  });

  const paid = await settlePlatformPaymentOrder(order.id, {
    providerTradeNo: "VERIFY_PROVIDER_TRADE_NO",
    paidAt: "2026-05-17T03:00:00.000Z",
  });

  assert.equal(paid.status, "paid");
  assert.equal(paid.creditsGranted, 70000);

  const updatedSubscriber = await getPlatformSubscriberById(subscriber.id);
  assert.equal(updatedSubscriber.planId, "verify-pro");
  assert.equal(updatedSubscriber.creditBalance, 70100);

  const ledger = await getPlatformLedger({ subscriberId: subscriber.id, limit: 10 });
  assert.equal(ledger.filter((entry) => entry.type === "purchase").length, 1);

  await settlePlatformPaymentOrder(order.id, {
    providerTradeNo: "VERIFY_PROVIDER_TRADE_NO",
    paidAt: "2026-05-17T03:00:00.000Z",
  });

  const afterDuplicateCallback = await getPlatformSubscriberById(subscriber.id);
  assert.equal(afterDuplicateCallback.creditBalance, 70100);

  const ledgerAfterDuplicate = await getPlatformLedger({ subscriberId: subscriber.id, limit: 10 });
  assert.equal(ledgerAfterDuplicate.filter((entry) => entry.type === "purchase").length, 1);

  console.log("Payment settlement verification passed");
} finally {
  try {
    const { getAdapter } = await import("../src/lib/db/driver.js");
    const adapter = await getAdapter();
    adapter.close?.();
  } catch {}
  fs.rmSync(dataDir, { recursive: true, force: true });
}
