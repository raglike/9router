import { TABLES, buildCreateTableSql } from "../schema.js";

export default {
  version: 5,
  name: "platform-payments",
  up(db) {
    db.exec(buildCreateTableSql("platformPaymentOrders", TABLES.platformPaymentOrders));
    for (const idx of TABLES.platformPaymentOrders.indexes || []) db.exec(idx);
  },
};
