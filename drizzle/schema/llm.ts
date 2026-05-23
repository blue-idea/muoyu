import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const userLlmConfigs = pgTable(
  "user_llm_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    baseUrl: varchar("base_url", { length: 512 }).notNull(),
    encryptedApiKey: varchar("encrypted_api_key", { length: 4096 }).notNull(),
    modelName: varchar("model_name", { length: 120 }).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("idx_llm_user_id").on(table.userId),
    uniqueIndex("idx_llm_user_default").on(table.userId, table.isDefault),
  ],
);
