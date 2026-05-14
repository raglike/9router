import { v4 as uuidv4 } from "uuid";
import crypto from "node:crypto";
import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { TABLES, buildCreateTableSql } from "../schema.js";

export const PLATFORM_CREDIT_UNIT_USD = 0.001;
const PLATFORM_PLAN_CURRENCY = "CNY";

const DEFAULT_PLANS = [
  {
    id: "starter",
    name: "Starter",
    description: "适合个人开发者的基础订阅",
    priceCents: 1900,
    currency: PLATFORM_PLAN_CURRENCY,
    monthlyCredits: 20000,
    maxRequestsPerDay: 1000,
    sortOrder: 10,
    features: ["OpenAI 兼容接口", "基础模型广场", "用量日志"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "适合小团队的高频调用订阅",
    priceCents: 4900,
    currency: PLATFORM_PLAN_CURRENCY,
    monthlyCredits: 70000,
    maxRequestsPerDay: 5000,
    sortOrder: 20,
    features: ["更高积分额度", "费用明细", "订阅 API Key"],
  },
  {
    id: "business",
    name: "Business",
    description: "适合对外产品接入的团队订阅",
    priceCents: 9900,
    currency: PLATFORM_PLAN_CURRENCY,
    monthlyCredits: 160000,
    maxRequestsPerDay: 20000,
    sortOrder: 30,
    features: ["团队级额度", "调用审计", "优先路由能力"],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function nextMonthIso(date = new Date()) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next.toISOString();
}

function toBool(value) {
  return value === 1 || value === true;
}

function rowToPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId || null,
    name: row.name,
    description: row.description || "",
    priceCents: row.priceCents || 0,
    currency: row.currency || PLATFORM_PLAN_CURRENCY,
    monthlyCredits: row.monthlyCredits || 0,
    maxRequestsPerDay: row.maxRequestsPerDay || 0,
    isActive: toBool(row.isActive),
    sortOrder: row.sortOrder || 0,
    data: parseJson(row.data, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToSubscriber(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    status: row.status || "active",
    planId: row.planId || null,
    creditBalance: row.creditBalance || 0,
    periodStart: row.periodStart || null,
    periodEnd: row.periodEnd || null,
    data: parseJson(row.data, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    planName: row.planName || null,
    apiKeys: row.apiKeys ? parseJson(row.apiKeys, []) : [],
  };
}

function rowToLedger(row) {
  if (!row) return null;
  return {
    id: row.id,
    subscriberId: row.subscriberId,
    subscriberName: row.subscriberName || null,
    apiKey: row.apiKey || null,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balanceAfter,
    cost: row.cost || 0,
    description: row.description || "",
    usageTimestamp: row.usageTimestamp || null,
    provider: row.provider || "",
    model: row.model || "",
    endpoint: row.endpoint || "",
    promptTokens: row.promptTokens || 0,
    completionTokens: row.completionTokens || 0,
    meta: parseJson(row.meta, {}),
    createdAt: row.createdAt,
  };
}

function rowToRedemptionCode(row) {
  if (!row) return null;
  return {
    id: row.id,
    codePrefix: row.codePrefix,
    codeSuffix: row.codeSuffix,
    maskedCode: `${row.codePrefix}...${row.codeSuffix}`,
    credits: row.credits || 0,
    status: row.status || "active",
    maxRedemptions: row.maxRedemptions || 1,
    redeemedCount: row.redeemedCount || 0,
    expiresAt: row.expiresAt || null,
    createdByUserId: row.createdByUserId || null,
    data: parseJson(row.data, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeRedemptionCode(code) {
  return String(code || "").trim().replace(/\s+/g, "").toUpperCase();
}

function hashRedemptionCode(code) {
  return crypto.createHash("sha256").update(normalizeRedemptionCode(code)).digest("hex");
}

function generateRedemptionCode() {
  return `NR-${crypto.randomBytes(24).toString("base64url").toUpperCase()}`;
}

function ensureRedemptionTables(db) {
  for (const tableName of ["platformRedemptionCodes", "platformRedemptionClaims"]) {
    const def = TABLES[tableName];
    db.exec(buildCreateTableSql(tableName, def));
    for (const idx of def.indexes || []) db.exec(idx);
  }
}

async function ensureDefaultPlans(db) {
  const row = db.get(`SELECT COUNT(*) AS count FROM platformPlans`);
  if ((row?.count || 0) > 0) {
    db.run(
      `UPDATE platformPlans SET currency = ? WHERE id IN ('starter', 'pro', 'business') AND currency = 'USD'`,
      [PLATFORM_PLAN_CURRENCY],
    );
    return;
  }
  const createdAt = nowIso();
  for (const plan of DEFAULT_PLANS) {
    db.run(
      `INSERT INTO platformPlans(id, name, description, priceCents, currency, monthlyCredits, maxRequestsPerDay, isActive, sortOrder, data, createdAt, updatedAt)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        plan.name,
        plan.description,
        plan.priceCents,
        plan.currency,
        plan.monthlyCredits,
        plan.maxRequestsPerDay,
        1,
        plan.sortOrder,
        stringifyJson({ features: plan.features }),
        createdAt,
        createdAt,
      ],
    );
  }
}

export async function getPlatformPlans({ includeInactive = true } = {}) {
  const db = await getAdapter();
  await ensureDefaultPlans(db);
  const where = includeInactive ? "" : "WHERE isActive = 1";
  return db.all(`SELECT * FROM platformPlans ${where} ORDER BY sortOrder DESC, createdAt ASC`).map(rowToPlan);
}

export async function getPlatformPlanById(id) {
  const db = await getAdapter();
  await ensureDefaultPlans(db);
  return rowToPlan(db.get(`SELECT * FROM platformPlans WHERE id = ?`, [id]));
}

export async function upsertPlatformPlan(input) {
  const db = await getAdapter();
  const id = input.id || uuidv4();
  const existing = db.get(`SELECT * FROM platformPlans WHERE id = ?`, [id]);
  const createdAt = existing?.createdAt || nowIso();
  const updatedAt = nowIso();
  const data = input.data || {};

  db.run(
    `INSERT INTO platformPlans(id, name, description, priceCents, currency, monthlyCredits, maxRequestsPerDay, isActive, sortOrder, data, createdAt, updatedAt)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       priceCents = excluded.priceCents,
       currency = excluded.currency,
       monthlyCredits = excluded.monthlyCredits,
       maxRequestsPerDay = excluded.maxRequestsPerDay,
       isActive = excluded.isActive,
       sortOrder = excluded.sortOrder,
       data = excluded.data,
       updatedAt = excluded.updatedAt`,
    [
      id,
      String(input.name || "").trim(),
      input.description || "",
      Number(input.priceCents || 0),
      input.currency || PLATFORM_PLAN_CURRENCY,
      Number(input.monthlyCredits || 0),
      Number(input.maxRequestsPerDay || 0),
      input.isActive === false ? 0 : 1,
      Number(input.sortOrder || 0),
      stringifyJson(data),
      createdAt,
      updatedAt,
    ],
  );

  return getPlatformPlanById(id);
}

export async function deletePlatformPlan(id) {
  const db = await getAdapter();
  const inUse = db.get(`SELECT COUNT(*) AS count FROM platformSubscribers WHERE planId = ?`, [id]);
  if ((inUse?.count || 0) > 0) {
    throw new Error("Plan is in use");
  }
  const res = db.run(`DELETE FROM platformPlans WHERE id = ?`, [id]);
  return (res?.changes || 0) > 0;
}

export async function getPlatformSubscribers() {
  const db = await getAdapter();
  await ensureDefaultPlans(db);
  const rows = db.all(`
    SELECT s.*, p.name AS planName
    FROM platformSubscribers s
    LEFT JOIN platformPlans p ON p.id = s.planId
    ORDER BY s.createdAt DESC
  `);
  const apiKeys = db.all(`SELECT id, key, name, subscriberId, isActive, createdAt FROM apiKeys WHERE subscriberId IS NOT NULL`);
  const keysBySubscriber = {};
  for (const key of apiKeys) {
    keysBySubscriber[key.subscriberId] ||= [];
    keysBySubscriber[key.subscriberId].push({
      id: key.id,
      key: key.key,
      name: key.name,
      isActive: toBool(key.isActive),
      createdAt: key.createdAt,
    });
  }
  return rows.map((row) => ({
    ...rowToSubscriber(row),
    apiKeys: keysBySubscriber[row.id] || [],
  }));
}

export async function getPlatformSubscriberById(id) {
  const subscribers = await getPlatformSubscribers();
  return subscribers.find((subscriber) => subscriber.id === id) || null;
}

export async function createPlatformSubscriber(input, machineId) {
  if (input.createApiKey !== false && !machineId) throw new Error("machineId is required");
  const db = await getAdapter();
  await ensureDefaultPlans(db);

  const plan = input.planId ? await getPlatformPlanById(input.planId) : null;
  const createdAt = nowIso();
  const subscriberId = uuidv4();
  const creditBalance = input.creditBalance !== undefined
    ? Number(input.creditBalance)
    : Number(plan?.monthlyCredits || 0);
  let apiKey = null;

  db.transaction(() => {
    db.run(
      `INSERT INTO platformSubscribers(id, userId, name, email, status, planId, creditBalance, periodStart, periodEnd, data, createdAt, updatedAt)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscriberId,
        input.userId || null,
        String(input.name || "").trim(),
        input.email || null,
        input.status || "active",
        input.planId || null,
        creditBalance,
        input.periodStart || createdAt,
        input.periodEnd || nextMonthIso(new Date(createdAt)),
        stringifyJson(input.data || {}),
        createdAt,
        createdAt,
      ],
    );

    db.run(
      `INSERT INTO platformCreditLedger(id, subscriberId, type, amount, balanceAfter, description, meta, createdAt)
       VALUES(?, ?, 'grant', ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        subscriberId,
        creditBalance,
        creditBalance,
        plan ? `订阅 ${plan.name} 初始积分` : "初始积分",
        stringifyJson({ planId: input.planId || null }),
        createdAt,
      ],
    );
  });

  if (input.createApiKey !== false) {
    apiKey = await createSubscriberApiKey(subscriberId, input.keyName || `${input.name || "Subscriber"} API Key`, machineId);
  }

  const subscriber = await getPlatformSubscriberById(subscriberId);
  return { subscriber, apiKey };
}

export async function updatePlatformSubscriber(id, input) {
  const db = await getAdapter();
  const current = rowToSubscriber(db.get(`SELECT * FROM platformSubscribers WHERE id = ?`, [id]));
  if (!current) return null;

  const next = {
    ...current,
    ...input,
    data: { ...(current.data || {}), ...(input.data || {}) },
    updatedAt: nowIso(),
  };

  db.run(
    `UPDATE platformSubscribers
     SET userId = ?, name = ?, email = ?, status = ?, planId = ?, creditBalance = ?, periodStart = ?, periodEnd = ?, data = ?, updatedAt = ?
     WHERE id = ?`,
    [
      next.userId || null,
      String(next.name || "").trim(),
      next.email || null,
      next.status || "active",
      next.planId || null,
      Number(next.creditBalance || 0),
      next.periodStart || null,
      next.periodEnd || null,
      stringifyJson(next.data || {}),
      next.updatedAt,
      id,
    ],
  );

  return getPlatformSubscriberById(id);
}

export async function deletePlatformSubscriber(id) {
  const db = await getAdapter();
  db.transaction(() => {
    db.run(`UPDATE apiKeys SET subscriberId = NULL WHERE subscriberId = ?`, [id]);
    db.run(`DELETE FROM platformCreditLedger WHERE subscriberId = ?`, [id]);
    db.run(`DELETE FROM platformSubscribers WHERE id = ?`, [id]);
  });
  return true;
}

export async function createSubscriberApiKey(subscriberId, name, machineId) {
  const db = await getAdapter();
  const subscriber = db.get(`SELECT id FROM platformSubscribers WHERE id = ?`, [subscriberId]);
  if (!subscriber) throw new Error("Subscriber not found");

  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const id = uuidv4();
  const createdAt = nowIso();

  db.run(
    `INSERT INTO apiKeys(id, key, name, machineId, subscriberId, isActive, createdAt) VALUES(?, ?, ?, ?, ?, 1, ?)`,
    [id, result.key, name || "Subscriber API Key", machineId, subscriberId, createdAt],
  );

  return { id, key: result.key, name: name || "Subscriber API Key", machineId, subscriberId, isActive: true, createdAt };
}

export async function getPlatformLedger({ limit = 200, subscriberId } = {}) {
  const db = await getAdapter();
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const params = [];
  let where = "";
  if (subscriberId) {
    where = "WHERE l.subscriberId = ?";
    params.push(subscriberId);
  }
  params.push(safeLimit);

  return db.all(
    `SELECT l.*, s.name AS subscriberName
     FROM platformCreditLedger l
     LEFT JOIN platformSubscribers s ON s.id = l.subscriberId
     ${where}
     ORDER BY l.createdAt DESC
     LIMIT ?`,
    params,
  ).map(rowToLedger);
}

export async function adjustPlatformCredits(subscriberId, amount, description = "手动调整") {
  const db = await getAdapter();
  const delta = Number(amount || 0);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Invalid credit amount");
  let balanceAfter = 0;
  const createdAt = nowIso();

  db.transaction(() => {
    const row = db.get(`SELECT creditBalance FROM platformSubscribers WHERE id = ?`, [subscriberId]);
    if (!row) throw new Error("Subscriber not found");
    balanceAfter = Number(row.creditBalance || 0) + delta;
    db.run(`UPDATE platformSubscribers SET creditBalance = ?, updatedAt = ? WHERE id = ?`, [balanceAfter, createdAt, subscriberId]);
    db.run(
      `INSERT INTO platformCreditLedger(id, subscriberId, type, amount, balanceAfter, description, meta, createdAt)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), subscriberId, delta > 0 ? "grant" : "deduct", delta, balanceAfter, description, stringifyJson({ manual: true }), createdAt],
    );
  });

  return getPlatformSubscriberById(subscriberId);
}

export async function createRedemptionCode({ credits, maxRedemptions = 1, expiresAt = null, createdByUserId = null, data = {} } = {}) {
  const amount = Number(credits || 0);
  const maxUses = Number(maxRedemptions || 1);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Credits must be positive");
  if (!Number.isInteger(maxUses) || maxUses < 1) throw new Error("Max redemptions must be a positive integer");
  if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) throw new Error("Invalid expiration time");

  const db = await getAdapter();
  ensureRedemptionTables(db);
  const createdAt = nowIso();
  let code = "";
  let row = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = generateRedemptionCode();
    const codeHash = hashRedemptionCode(code);
    try {
      const id = uuidv4();
      db.run(
        `INSERT INTO platformRedemptionCodes(id, codeHash, codePrefix, codeSuffix, credits, status, maxRedemptions, redeemedCount, expiresAt, createdByUserId, data, createdAt, updatedAt)
         VALUES(?, ?, ?, ?, ?, 'active', ?, 0, ?, ?, ?, ?, ?)`,
        [id, codeHash, code.slice(0, 8), code.slice(-6), amount, maxUses, expiresAt || null, createdByUserId || null, stringifyJson(data), createdAt, createdAt],
      );
      row = db.get(`SELECT * FROM platformRedemptionCodes WHERE id = ?`, [id]);
      break;
    } catch (error) {
      if (!String(error.message || "").includes("UNIQUE")) throw error;
    }
  }

  if (!row) throw new Error("Failed to generate redemption code");
  return { ...rowToRedemptionCode(row), code };
}

export async function getRedemptionCodes({ limit = 100 } = {}) {
  const db = await getAdapter();
  ensureRedemptionTables(db);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return db.all(`SELECT * FROM platformRedemptionCodes ORDER BY createdAt DESC LIMIT ?`, [safeLimit]).map(rowToRedemptionCode);
}

export async function redeemPlatformCode({ code, subscriberId, userId }) {
  const normalized = normalizeRedemptionCode(code);
  if (normalized.length < 30) throw new Error("Redemption code must be at least 30 characters");
  if (!subscriberId) throw new Error("Subscriber is required");

  const db = await getAdapter();
  ensureRedemptionTables(db);
  const codeHash = hashRedemptionCode(normalized);
  const createdAt = nowIso();
  let result = null;

  db.transaction(() => {
    const redemption = db.get(`SELECT * FROM platformRedemptionCodes WHERE codeHash = ?`, [codeHash]);
    if (!redemption) throw new Error("Invalid redemption code");
    if (redemption.status !== "active") throw new Error("Redemption code is not active");
    if (redemption.expiresAt && new Date(redemption.expiresAt).getTime() < Date.now()) throw new Error("Redemption code has expired");
    if (Number(redemption.redeemedCount || 0) >= Number(redemption.maxRedemptions || 1)) throw new Error("Redemption code has been fully used");

    const existingClaim = db.get(`SELECT id FROM platformRedemptionClaims WHERE codeId = ? AND subscriberId = ?`, [redemption.id, subscriberId]);
    if (existingClaim) throw new Error("Redemption code already used");

    const subscriber = db.get(`SELECT creditBalance FROM platformSubscribers WHERE id = ?`, [subscriberId]);
    if (!subscriber) throw new Error("Subscriber not found");

    const amount = Number(redemption.credits || 0);
    const balanceAfter = Number(subscriber.creditBalance || 0) + amount;
    db.run(`UPDATE platformSubscribers SET creditBalance = ?, updatedAt = ? WHERE id = ?`, [balanceAfter, createdAt, subscriberId]);
    db.run(`UPDATE platformRedemptionCodes SET redeemedCount = redeemedCount + 1, updatedAt = ? WHERE id = ?`, [createdAt, redemption.id]);
    db.run(
      `INSERT INTO platformRedemptionClaims(id, codeId, subscriberId, userId, amount, balanceAfter, createdAt)
       VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), redemption.id, subscriberId, userId || null, amount, balanceAfter, createdAt],
    );
    db.run(
      `INSERT INTO platformCreditLedger(id, subscriberId, type, amount, balanceAfter, description, meta, createdAt)
       VALUES(?, ?, 'redeem', ?, ?, ?, ?, ?)`,
      [uuidv4(), subscriberId, amount, balanceAfter, "兑换码兑换积分", stringifyJson({ redemptionCodeId: redemption.id, codePrefix: redemption.codePrefix, codeSuffix: redemption.codeSuffix }), createdAt],
    );
    result = { credits: amount, balanceAfter };
  });

  return result;
}

export async function getSubscriberAccessByApiKey(apiKey) {
  if (!apiKey) return { mode: "local", allowed: true };
  const db = await getAdapter();
  const row = db.get(
    `SELECT ak.key, ak.isActive AS keyActive, s.*, p.name AS planName, p.maxRequestsPerDay AS planMaxRequestsPerDay
     FROM apiKeys ak
     LEFT JOIN platformSubscribers s ON s.id = ak.subscriberId
     LEFT JOIN platformPlans p ON p.id = s.planId
     WHERE ak.key = ?`,
    [apiKey],
  );

  if (!row?.id) return { mode: "local", allowed: true };
  const subscriber = rowToSubscriber(row);
  if (!toBool(row.keyActive)) return { mode: "platform", allowed: false, reason: "API key is disabled", subscriber };
  if (subscriber.status !== "active") return { mode: "platform", allowed: false, reason: "Subscription is not active", subscriber };
  if (subscriber.periodEnd && new Date(subscriber.periodEnd).getTime() < Date.now()) {
    return { mode: "platform", allowed: false, reason: "Subscription has expired", subscriber };
  }
  if ((subscriber.creditBalance || 0) <= 0) {
    return { mode: "platform", allowed: false, reason: "Insufficient subscription credits", subscriber };
  }
  if (Number(row.planMaxRequestsPerDay || 0) > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usage = db.get(
      `SELECT COUNT(*) AS count FROM platformCreditLedger WHERE subscriberId = ? AND type = 'usage' AND createdAt >= ?`,
      [subscriber.id, today.toISOString()],
    );
    if ((usage?.count || 0) >= Number(row.planMaxRequestsPerDay)) {
      return { mode: "platform", allowed: false, reason: "Daily request limit reached", subscriber };
    }
  }
  return { mode: "platform", allowed: true, subscriber };
}

export async function consumeCreditsForUsage(entry) {
  if (!entry?.apiKey) return null;
  const access = await getSubscriberAccessByApiKey(entry.apiKey);
  if (access.mode !== "platform" || !access.subscriber) return null;

  const cost = Number(entry.cost || 0);
  const amount = cost > 0 ? -Number((cost / PLATFORM_CREDIT_UNIT_USD).toFixed(6)) : 0;
  if (amount === 0) return null;

  const tokens = entry.tokens || {};
  const promptTokens = tokens.prompt_tokens || tokens.input_tokens || 0;
  const completionTokens = tokens.completion_tokens || tokens.output_tokens || 0;
  const createdAt = nowIso();
  let balanceAfter = 0;

  const db = await getAdapter();
  db.transaction(() => {
    const current = db.get(`SELECT creditBalance FROM platformSubscribers WHERE id = ?`, [access.subscriber.id]);
    balanceAfter = Number(current?.creditBalance || 0) + amount;
    db.run(`UPDATE platformSubscribers SET creditBalance = ?, updatedAt = ? WHERE id = ?`, [balanceAfter, createdAt, access.subscriber.id]);
    db.run(
      `INSERT INTO platformCreditLedger(id, subscriberId, apiKey, type, amount, balanceAfter, cost, description, usageTimestamp, provider, model, endpoint, promptTokens, completionTokens, meta, createdAt)
       VALUES(?, ?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        access.subscriber.id,
        entry.apiKey,
        amount,
        balanceAfter,
        cost,
        `模型调用 ${entry.model || "-"}`,
        entry.timestamp || createdAt,
        entry.provider || null,
        entry.model || null,
        entry.endpoint || null,
        promptTokens,
        completionTokens,
        stringifyJson({ status: entry.status || "ok" }),
        createdAt,
      ],
    );
  });

  return { subscriberId: access.subscriber.id, amount, balanceAfter };
}

export async function getPlatformOverview({ subscriberId } = {}) {
  const db = await getAdapter();
  await ensureDefaultPlans(db);
  const params = subscriberId ? [subscriberId] : [];
  const subscriberWhere = subscriberId ? "WHERE id = ?" : "";
  const ledgerWhere = subscriberId ? "WHERE subscriberId = ? AND type = 'usage'" : "WHERE type = 'usage'";
  const usageWhere = subscriberId ? "WHERE apiKey IN (SELECT key FROM apiKeys WHERE subscriberId = ?)" : "";
  const usageTypeWhere = subscriberId ? "WHERE type = 'usage' AND subscriberId = ?" : "WHERE type = 'usage'";

  const subscriberStats = db.get(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(creditBalance) AS credits FROM platformSubscribers ${subscriberWhere}`,
    params,
  );
  const ledgerStats = db.get(
    `SELECT SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS consumed, SUM(cost) AS cost FROM platformCreditLedger ${usageTypeWhere}`,
    params,
  );
  const usageStats = db.get(
    `SELECT COUNT(*) AS requests, SUM(promptTokens) AS promptTokens, SUM(completionTokens) AS completionTokens, SUM(cost) AS cost FROM usageHistory ${usageWhere}`,
    params,
  );
  const ledgerRows = db.all(
    `SELECT createdAt, usageTimestamp, amount, cost, provider, model, promptTokens, completionTokens
     FROM platformCreditLedger ${ledgerWhere}
     ORDER BY createdAt DESC LIMIT 100`,
    params,
  );

  const byModel = {};
  const daily = {};
  for (const row of ledgerRows) {
    const modelKey = row.provider ? `${row.provider}/${row.model || "-"}` : row.model || "-";
    byModel[modelKey] ||= { model: modelKey, requests: 0, credits: 0, cost: 0, tokens: 0 };
    byModel[modelKey].requests += 1;
    byModel[modelKey].credits += Math.abs(row.amount || 0);
    byModel[modelKey].cost += row.cost || 0;
    byModel[modelKey].tokens += (row.promptTokens || 0) + (row.completionTokens || 0);

    const day = (row.usageTimestamp || row.createdAt || "").slice(0, 10);
    if (day) {
      daily[day] ||= { date: day, requests: 0, credits: 0, cost: 0 };
      daily[day].requests += 1;
      daily[day].credits += Math.abs(row.amount || 0);
      daily[day].cost += row.cost || 0;
    }
  }

  return {
    creditUnitUsd: PLATFORM_CREDIT_UNIT_USD,
    subscribers: {
      total: subscriberStats?.total || 0,
      active: subscriberStats?.active || 0,
      remainingCredits: subscriberStats?.credits || 0,
    },
    usage: {
      requests: usageStats?.requests || 0,
      promptTokens: usageStats?.promptTokens || 0,
      completionTokens: usageStats?.completionTokens || 0,
      cost: usageStats?.cost || 0,
      consumedCredits: ledgerStats?.consumed || 0,
      billedCost: ledgerStats?.cost || 0,
    },
    charts: {
      byModel: Object.values(byModel).sort((a, b) => b.credits - a.credits).slice(0, 10),
      daily: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}
