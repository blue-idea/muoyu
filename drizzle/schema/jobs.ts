import { sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { jobStatusEnum } from "./enums";
import { projects } from "./projects";

export const planningJobs = pgTable(
  "planning_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").default("pending").notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    lockedBy: varchar("locked_by", { length: 64 }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: varchar("last_error", { length: 1024 }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("idx_planning_jobs_project_status").on(table.projectId, table.status),
    index("idx_planning_jobs_pending").on(table.status, table.createdAt),
  ],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").default("pending").notNull(),
    currentChapterNumber: integer("current_chapter_number"),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "date" }),
    lockedBy: varchar("locked_by", { length: 64 }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    lastError: varchar("last_error", { length: 1024 }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("idx_jobs_project_status").on(table.projectId, table.status),
    index("idx_jobs_pending").on(table.status, table.createdAt),
  ],
);
