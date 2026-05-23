import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { exportFormatEnum } from "./enums";
import type { JsonObject } from "./json";
import { projects } from "./projects";

export const exportRecords = pgTable(
  "export_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    format: exportFormatEnum("format").notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default(sql`'{}'::jsonb`),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_export_records_project").on(table.projectId),
    index("idx_export_records_user").on(table.userId),
  ],
);
