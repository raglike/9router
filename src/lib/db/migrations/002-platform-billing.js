import { TABLES, buildCreateTableSql } from "../schema.js";

const PLATFORM_TABLES = ["platformPlans", "platformSubscribers", "platformCreditLedger"];

export default {
  version: 2,
  name: "platform-billing",
  up(db) {
    const apiKeyColumns = new Set(db.all(`PRAGMA table_info(apiKeys)`).map((r) => r.name));
    if (!apiKeyColumns.has("subscriberId")) {
      db.exec(`ALTER TABLE apiKeys ADD COLUMN subscriberId TEXT`);
    }

    for (const tableName of PLATFORM_TABLES) {
      const def = TABLES[tableName];
      db.exec(buildCreateTableSql(tableName, def));
      for (const idx of def.indexes || []) db.exec(idx);
    }

    for (const idx of TABLES.apiKeys.indexes || []) db.exec(idx);
  },
};
