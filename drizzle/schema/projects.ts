import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { projectStatusEnum } from "./enums";
import type { JsonObject } from "./json";
import { userLlmConfigs } from "./llm";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull(),
    status: projectStatusEnum("status").default("draft").notNull(),
    storagePrefix: varchar("storage_prefix", { length: 512 }).notNull(),
    creationConfig: jsonb("creation_config").$type<JsonObject>(),
    planningReady: boolean("planning_ready").default(false).notNull(),
    llmConfigId: uuid("llm_config_id").references(() => userLlmConfigs.id, { onDelete: "set null" }),
    writingPlanEtag: varchar("writing_plan_etag", { length: 64 }),
    chapterCompletedCount: integer("chapter_completed_count").default(0).notNull(),
    totalChapters: integer("total_chapters"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    storageDeletePending: boolean("storage_delete_pending").default(false).notNull(),
  },
  (table) => [
    index("idx_projects_user_status").on(table.userId, table.status),
    index("idx_projects_user_updated").on(table.userId, table.updatedAt),
    uniqueIndex("projects_user_slug_unique").on(table.userId, table.slug),
  ],
);
