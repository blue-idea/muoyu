import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { contentFileTypeEnum } from "./enums";
import { projects } from "./projects";

export const contentFiles = pgTable(
  "content_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fileType: contentFileTypeEnum("file_type").notNull(),
    relativePath: varchar("relative_path", { length: 255 }).notNull(),
    chapterNumber: integer("chapter_number"),
    title: varchar("title", { length: 200 }),
    wordCount: integer("word_count"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    uniqueIndex("content_files_project_relative_path_unique").on(table.projectId, table.relativePath),
    index("idx_content_files_project_type").on(table.projectId, table.fileType),
    index("idx_content_files_project_chapter").on(table.projectId, table.chapterNumber),
  ],
);
