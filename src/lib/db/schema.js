// Latest schema version — bumped when a migration is added in ./migrations/
export const SCHEMA_VERSION = 4;

export const PRAGMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 30000000;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

// Declarative current schema. Used by syncSchemaFromTables() to
// auto-add missing tables/columns/indexes after versioned migrations.
// For destructive changes (drop/rename/type-change), write a migration file.
export const TABLES = {
  _meta: {
    columns: {
      key: "TEXT PRIMARY KEY",
      value: "TEXT NOT NULL",
    },
  },
  settings: {
    columns: {
      id: "INTEGER PRIMARY KEY CHECK (id = 1)",
      data: "TEXT NOT NULL",
    },
  },
  providerConnections: {
    columns: {
      id: "TEXT PRIMARY KEY",
      provider: "TEXT NOT NULL",
      authType: "TEXT NOT NULL",
      name: "TEXT",
      email: "TEXT",
      priority: "INTEGER",
      isActive: "INTEGER DEFAULT 1",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pc_provider ON providerConnections(provider)",
      "CREATE INDEX IF NOT EXISTS idx_pc_provider_active ON providerConnections(provider, isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pc_priority ON providerConnections(provider, priority)",
    ],
  },
  providerNodes: {
    columns: {
      id: "TEXT PRIMARY KEY",
      type: "TEXT",
      name: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_pn_type ON providerNodes(type)"],
  },
  proxyPools: {
    columns: {
      id: "TEXT PRIMARY KEY",
      isActive: "INTEGER DEFAULT 1",
      testStatus: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_pp_active ON proxyPools(isActive)",
      "CREATE INDEX IF NOT EXISTS idx_pp_status ON proxyPools(testStatus)",
    ],
  },
  apiKeys: {
    columns: {
      id: "TEXT PRIMARY KEY",
      key: "TEXT UNIQUE NOT NULL",
      name: "TEXT",
      machineId: "TEXT",
      subscriberId: "TEXT",
      isActive: "INTEGER DEFAULT 1",
      createdAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_ak_key ON apiKeys(key)",
      "CREATE INDEX IF NOT EXISTS idx_ak_subscriber ON apiKeys(subscriberId)",
    ],
  },
  combos: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT UNIQUE NOT NULL",
      kind: "TEXT",
      models: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: ["CREATE INDEX IF NOT EXISTS idx_combo_name ON combos(name)"],
  },
  kv: {
    columns: {
      scope: "TEXT NOT NULL",
      key: "TEXT NOT NULL",
      value: "TEXT NOT NULL",
    },
    primaryKey: "PRIMARY KEY (scope, key)",
    indexes: ["CREATE INDEX IF NOT EXISTS idx_kv_scope ON kv(scope)"],
  },
  usageHistory: {
    columns: {
      id: "INTEGER PRIMARY KEY AUTOINCREMENT",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      apiKey: "TEXT",
      endpoint: "TEXT",
      promptTokens: "INTEGER DEFAULT 0",
      completionTokens: "INTEGER DEFAULT 0",
      cost: "REAL DEFAULT 0",
      status: "TEXT",
      tokens: "TEXT",
      meta: "TEXT",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_uh_ts ON usageHistory(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_uh_provider ON usageHistory(provider)",
      "CREATE INDEX IF NOT EXISTS idx_uh_model ON usageHistory(model)",
      "CREATE INDEX IF NOT EXISTS idx_uh_conn ON usageHistory(connectionId)",
    ],
  },
  usageDaily: {
    columns: {
      dateKey: "TEXT PRIMARY KEY",
      data: "TEXT NOT NULL",
    },
  },
  requestDetails: {
    columns: {
      id: "TEXT PRIMARY KEY",
      timestamp: "TEXT NOT NULL",
      provider: "TEXT",
      model: "TEXT",
      connectionId: "TEXT",
      status: "TEXT",
      data: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_rd_ts ON requestDetails(timestamp DESC)",
      "CREATE INDEX IF NOT EXISTS idx_rd_provider ON requestDetails(provider)",
      "CREATE INDEX IF NOT EXISTS idx_rd_model ON requestDetails(model)",
      "CREATE INDEX IF NOT EXISTS idx_rd_conn ON requestDetails(connectionId)",
    ],
  },
  platformPlans: {
    columns: {
      id: "TEXT PRIMARY KEY",
      name: "TEXT NOT NULL",
      description: "TEXT",
      priceCents: "INTEGER DEFAULT 0",
      currency: "TEXT DEFAULT 'CNY'",
      monthlyCredits: "REAL DEFAULT 0",
      maxRequestsPerDay: "INTEGER DEFAULT 0",
      isActive: "INTEGER DEFAULT 1",
      sortOrder: "INTEGER DEFAULT 0",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_platform_plans_active ON platformPlans(isActive, sortOrder)",
    ],
  },
  platformSubscribers: {
    columns: {
      id: "TEXT PRIMARY KEY",
      userId: "TEXT",
      name: "TEXT NOT NULL",
      email: "TEXT",
      status: "TEXT DEFAULT 'active'",
      planId: "TEXT",
      creditBalance: "REAL DEFAULT 0",
      periodStart: "TEXT",
      periodEnd: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_platform_subscribers_user ON platformSubscribers(userId)",
      "CREATE INDEX IF NOT EXISTS idx_platform_subscribers_status ON platformSubscribers(status)",
      "CREATE INDEX IF NOT EXISTS idx_platform_subscribers_plan ON platformSubscribers(planId)",
    ],
  },
  platformUsers: {
    columns: {
      id: "TEXT PRIMARY KEY",
      username: "TEXT UNIQUE NOT NULL",
      email: "TEXT UNIQUE",
      passwordHash: "TEXT NOT NULL",
      displayName: "TEXT",
      role: "TEXT NOT NULL DEFAULT 'user'",
      status: "TEXT NOT NULL DEFAULT 'active'",
      subscriberId: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platformUsers(role)",
      "CREATE INDEX IF NOT EXISTS idx_platform_users_status ON platformUsers(status)",
      "CREATE INDEX IF NOT EXISTS idx_platform_users_subscriber ON platformUsers(subscriberId)",
    ],
  },
  platformCreditLedger: {
    columns: {
      id: "TEXT PRIMARY KEY",
      subscriberId: "TEXT NOT NULL",
      apiKey: "TEXT",
      type: "TEXT NOT NULL",
      amount: "REAL NOT NULL",
      balanceAfter: "REAL NOT NULL",
      cost: "REAL DEFAULT 0",
      description: "TEXT",
      usageTimestamp: "TEXT",
      provider: "TEXT",
      model: "TEXT",
      endpoint: "TEXT",
      promptTokens: "INTEGER DEFAULT 0",
      completionTokens: "INTEGER DEFAULT 0",
      meta: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_platform_ledger_subscriber ON platformCreditLedger(subscriberId, createdAt DESC)",
      "CREATE INDEX IF NOT EXISTS idx_platform_ledger_api_key ON platformCreditLedger(apiKey)",
      "CREATE INDEX IF NOT EXISTS idx_platform_ledger_usage_ts ON platformCreditLedger(usageTimestamp DESC)",
    ],
  },
  platformRedemptionCodes: {
    columns: {
      id: "TEXT PRIMARY KEY",
      codeHash: "TEXT UNIQUE NOT NULL",
      codePrefix: "TEXT NOT NULL",
      codeSuffix: "TEXT NOT NULL",
      credits: "REAL NOT NULL",
      status: "TEXT NOT NULL DEFAULT 'active'",
      maxRedemptions: "INTEGER NOT NULL DEFAULT 1",
      redeemedCount: "INTEGER NOT NULL DEFAULT 0",
      expiresAt: "TEXT",
      createdByUserId: "TEXT",
      data: "TEXT NOT NULL",
      createdAt: "TEXT NOT NULL",
      updatedAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_platform_redemption_hash ON platformRedemptionCodes(codeHash)",
      "CREATE INDEX IF NOT EXISTS idx_platform_redemption_status ON platformRedemptionCodes(status, expiresAt)",
    ],
  },
  platformRedemptionClaims: {
    columns: {
      id: "TEXT PRIMARY KEY",
      codeId: "TEXT NOT NULL",
      subscriberId: "TEXT NOT NULL",
      userId: "TEXT",
      amount: "REAL NOT NULL",
      balanceAfter: "REAL NOT NULL",
      createdAt: "TEXT NOT NULL",
    },
    indexes: [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_redemption_claim_once ON platformRedemptionClaims(codeId, subscriberId)",
      "CREATE INDEX IF NOT EXISTS idx_platform_redemption_claim_subscriber ON platformRedemptionClaims(subscriberId, createdAt DESC)",
    ],
  },
};

export function buildCreateTableSql(name, def) {
  const cols = Object.entries(def.columns).map(([k, v]) => `${k} ${v}`);
  if (def.primaryKey) cols.push(def.primaryKey);
  return `CREATE TABLE IF NOT EXISTS ${name} (${cols.join(", ")})`;
}
