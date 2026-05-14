import { TABLES, buildCreateTableSql } from "../schema.js";

export default {
  version: 3,
  name: "platform-users",
  up(db) {
    const subscriberColumns = new Set(db.all(`PRAGMA table_info(platformSubscribers)`).map((r) => r.name));
    if (!subscriberColumns.has("userId")) {
      db.exec(`ALTER TABLE platformSubscribers ADD COLUMN userId TEXT`);
    }

    db.exec(buildCreateTableSql("platformUsers", TABLES.platformUsers));
    for (const idx of TABLES.platformUsers.indexes || []) db.exec(idx);
    for (const idx of TABLES.platformSubscribers.indexes || []) db.exec(idx);
  },
};
