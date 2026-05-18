import { v4 as uuidv4 } from "uuid";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";

function nowIso() {
  return new Date().toISOString();
}

function nextMonthIso(date = new Date()) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

function rowToPaymentOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    subscriberId: row.subscriberId,
    planId: row.planId,
    planName: row.planName || null,
    provider: row.provider,
    channel: row.channel,
    outTradeNo: row.outTradeNo,
    providerTradeNo: row.providerTradeNo || null,
    amountCents: row.amountCents || 0,
    currency: row.currency || "CNY",
    status: row.status || "pending",
    subject: row.subject || "",
    creditsGranted: Number(row.creditsGranted || 0),
    lastCheckedAt: row.lastCheckedAt || null,
    expiresAt: row.expiresAt || null,
    paidAt: row.paidAt || null,
    settledAt: row.settledAt || null,
    meta: parseJson(row.meta, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getPaymentOrderRow(whereSql, params) {
  const db = await getAdapter();
  return db.get(
    `SELECT o.*, p.name AS planName
     FROM platformPaymentOrders o
     LEFT JOIN platformPlans p ON p.id = o.planId
     ${whereSql}`,
    params,
  );
}

export async function listPlatformPaymentOrders({ userId, subscriberId, limit = 20 } = {}) {
  const db = await getAdapter();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const where = [];
  const params = [];
  if (userId) {
    where.push("o.userId = ?");
    params.push(userId);
  }
  if (subscriberId) {
    where.push("o.subscriberId = ?");
    params.push(subscriberId);
  }
  params.push(safeLimit);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db.all(
    `SELECT o.*, p.name AS planName
     FROM platformPaymentOrders o
     LEFT JOIN platformPlans p ON p.id = o.planId
     ${whereSql}
     ORDER BY o.createdAt DESC
     LIMIT ?`,
    params,
  ).map(rowToPaymentOrder);
}

export async function getPlatformPaymentOrderById(id) {
  return rowToPaymentOrder(await getPaymentOrderRow("WHERE o.id = ?", [id]));
}

export async function getPlatformPaymentOrderByOutTradeNo(outTradeNo) {
  return rowToPaymentOrder(await getPaymentOrderRow("WHERE o.outTradeNo = ?", [outTradeNo]));
}

export async function createPlatformPaymentOrder(input) {
  const db = await getAdapter();
  const id = input.id || uuidv4();
  const createdAt = nowIso();
  db.run(
    `INSERT INTO platformPaymentOrders(
      id, userId, subscriberId, planId, provider, channel, outTradeNo, providerTradeNo,
      amountCents, currency, status, subject, creditsGranted, lastCheckedAt, expiresAt,
      paidAt, settledAt, meta, createdAt, updatedAt
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.subscriberId,
      input.planId,
      input.provider,
      input.channel,
      input.outTradeNo,
      input.providerTradeNo || null,
      Number(input.amountCents || 0),
      input.currency || "CNY",
      input.status || "pending",
      String(input.subject || "").trim(),
      Number(input.creditsGranted || 0),
      input.lastCheckedAt || null,
      input.expiresAt || null,
      input.paidAt || null,
      input.settledAt || null,
      stringifyJson(input.meta || {}),
      createdAt,
      createdAt,
    ],
  );
  return getPlatformPaymentOrderById(id);
}

export async function updatePlatformPaymentOrder(id, updates) {
  const db = await getAdapter();
  const currentRow = db.get(`SELECT * FROM platformPaymentOrders WHERE id = ?`, [id]);
  const current = rowToPaymentOrder(currentRow);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
    meta: updates.meta ? { ...(current.meta || {}), ...(updates.meta || {}) } : current.meta,
    updatedAt: nowIso(),
  };

  db.run(
    `UPDATE platformPaymentOrders
     SET providerTradeNo = ?, status = ?, subject = ?, creditsGranted = ?, lastCheckedAt = ?,
         expiresAt = ?, paidAt = ?, settledAt = ?, meta = ?, updatedAt = ?
     WHERE id = ?`,
    [
      next.providerTradeNo || null,
      next.status || "pending",
      String(next.subject || "").trim(),
      Number(next.creditsGranted || 0),
      next.lastCheckedAt || null,
      next.expiresAt || null,
      next.paidAt || null,
      next.settledAt || null,
      stringifyJson(next.meta || {}),
      next.updatedAt,
      id,
    ],
  );

  return getPlatformPaymentOrderById(id);
}

export async function settlePlatformPaymentOrder(id, settlement = {}) {
  const db = await getAdapter();
  const settledAt = settlement.paidAt || nowIso();
  let order = null;

  db.transaction(() => {
    const orderRow = db.get(`SELECT * FROM platformPaymentOrders WHERE id = ?`, [id]);
    if (!orderRow) throw new Error("Order not found");

    if (orderRow.status === "paid" && Number(orderRow.creditsGranted || 0) > 0) {
      order = orderRow;
      return;
    }

    const plan = db.get(`SELECT * FROM platformPlans WHERE id = ?`, [orderRow.planId]);
    if (!plan || Number(plan.isActive || 0) !== 1) throw new Error("Plan is unavailable");

    const subscriber = db.get(`SELECT * FROM platformSubscribers WHERE id = ?`, [orderRow.subscriberId]);
    if (!subscriber) throw new Error("Subscriber not found");

    const planCredits = Number(plan.monthlyCredits || 0);
    const balanceAfter = Number(subscriber.creditBalance || 0) + planCredits;
    const existingEnd = subscriber.periodEnd ? new Date(subscriber.periodEnd) : null;
    const settlementDate = new Date(settledAt);
    const extendCurrentPlan = subscriber.planId === plan.id && existingEnd && existingEnd.getTime() > settlementDate.getTime();
    const periodStart = extendCurrentPlan ? subscriber.periodEnd : settledAt;
    const periodEnd = nextMonthIso(extendCurrentPlan ? existingEnd : settlementDate);
    const updatedAt = nowIso();
    const nextOrderMeta = {
      ...parseJson(orderRow.meta, {}),
      ...(settlement.meta || {}),
      settlement: {
        planId: plan.id,
        planName: plan.name,
        creditsGranted: planCredits,
        periodStart,
        periodEnd,
      },
    };

    db.run(
      `UPDATE platformSubscribers
       SET planId = ?, status = 'active', creditBalance = ?, periodStart = ?, periodEnd = ?, updatedAt = ?
       WHERE id = ?`,
      [plan.id, balanceAfter, periodStart, periodEnd, updatedAt, orderRow.subscriberId],
    );

    db.run(
      `INSERT INTO platformCreditLedger(
        id, subscriberId, type, amount, balanceAfter, description, meta, createdAt
      ) VALUES(?, ?, 'purchase', ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        orderRow.subscriberId,
        planCredits,
        balanceAfter,
        `支付购买 ${plan.name}`,
        stringifyJson({
          orderId: orderRow.id,
          provider: orderRow.provider,
          outTradeNo: orderRow.outTradeNo,
          providerTradeNo: settlement.providerTradeNo || orderRow.providerTradeNo || null,
        }),
        settledAt,
      ],
    );

    db.run(
      `UPDATE platformPaymentOrders
       SET providerTradeNo = ?, status = 'paid', creditsGranted = ?, lastCheckedAt = ?, paidAt = ?,
           settledAt = ?, meta = ?, updatedAt = ?
       WHERE id = ?`,
      [
        settlement.providerTradeNo || orderRow.providerTradeNo || null,
        planCredits,
        updatedAt,
        settledAt,
        settledAt,
        stringifyJson(nextOrderMeta),
        updatedAt,
        id,
      ],
    );

    order = db.get(`SELECT * FROM platformPaymentOrders WHERE id = ?`, [id]);
  });

  return getPlatformPaymentOrderById(order.id);
}
