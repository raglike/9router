import { TABLES, buildCreateTableSql } from "../schema.js";

const TABLE_NAMES = ["platformRedemptionCodes", "platformRedemptionClaims"];

const migration = {
  version: 4,
  name: "platform-redemptions",
  up(db) {
    for (const tableName of TABLE_NAMES) {
      const def = TABLES[tableName];
      db.exec(buildCreateTableSql(tableName, def));
      for (const idx of def.indexes || []) db.exec(idx);
    }
  },
};

export default migration;
