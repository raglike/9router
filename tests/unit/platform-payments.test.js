import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const tempDirs = [];

async function loadDbInTempDir() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-payments-"));
  tempDirs.push(dataDir);
  process.env.DATA_DIR = dataDir;
  global._dbAdapter = { instance: null, initPromise: null, logged: true };
  vi.resetModules();
  return import("../../src/lib/db/index.js");
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.DATA_DIR;
  global._dbAdapter = { instance: null, initPromise: null, logged: true };
  vi.resetModules();
});

describe("platform payment settlement", () => {
  it("grants plan credits to a normal subscriber exactly once after payment succeeds", async () => {
    const {
      createPlatformPaymentOrder,
      createPlatformSubscriber,
      getPlatformLedger,
      getPlatformSubscriberById,
      settlePlatformPaymentOrder,
      upsertPlatformPlan,
    } = await loadDbInTempDir();

    const plan = await upsertPlatformPlan({
      id: "test-pro",
      name: "Test Pro",
      description: "Test plan",
      priceCents: 4900,
      currency: "CNY",
      monthlyCredits: 70000,
      maxRequestsPerDay: 5000,
      isActive: true,
      sortOrder: 1,
    });
    const { subscriber } = await createPlatformSubscriber({
      userId: "user-1",
      name: "Normal User",
      email: "normal@example.com",
      creditBalance: 100,
      createApiKey: false,
    });
    const order = await createPlatformPaymentOrder({
      userId: "user-1",
      subscriberId: subscriber.id,
      planId: plan.id,
      provider: "alipay",
      channel: "alipay_page",
      outTradeNo: "NRTESTPAYMENT001",
      amountCents: plan.priceCents,
      currency: plan.currency,
      status: "pending",
      subject: "9Router Test Pro",
      meta: {},
    });

    const paid = await settlePlatformPaymentOrder(order.id, {
      providerTradeNo: "202605170000000001",
      paidAt: "2026-05-17T03:00:00.000Z",
      meta: { source: "unit-test" },
    });

    expect(paid.status).toBe("paid");
    expect(paid.creditsGranted).toBe(70000);
    expect(paid.providerTradeNo).toBe("202605170000000001");

    const updatedSubscriber = await getPlatformSubscriberById(subscriber.id);
    expect(updatedSubscriber.planId).toBe("test-pro");
    expect(updatedSubscriber.status).toBe("active");
    expect(updatedSubscriber.creditBalance).toBe(70100);

    const ledger = await getPlatformLedger({ subscriberId: subscriber.id, limit: 10 });
    const purchases = ledger.filter((entry) => entry.type === "purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0].amount).toBe(70000);
    expect(purchases[0].balanceAfter).toBe(70100);
    expect(purchases[0].meta.orderId).toBe(order.id);

    await settlePlatformPaymentOrder(order.id, {
      providerTradeNo: "202605170000000001",
      paidAt: "2026-05-17T03:00:00.000Z",
    });

    const afterDuplicateCallback = await getPlatformSubscriberById(subscriber.id);
    expect(afterDuplicateCallback.creditBalance).toBe(70100);
    const ledgerAfterDuplicate = await getPlatformLedger({ subscriberId: subscriber.id, limit: 10 });
    expect(ledgerAfterDuplicate.filter((entry) => entry.type === "purchase")).toHaveLength(1);
  });
});
