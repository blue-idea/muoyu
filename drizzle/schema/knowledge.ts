import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { knowledgeDocStatusEnum, knowledgeSourceTypeEnum } from "./enums";
import type { JsonObject } from "./json";
import { projects } from "./projects";

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    sourceType: knowledgeSourceTypeEnum("source_type").notNull(),
    sourceMeta: jsonb("source_meta").$type<JsonObject>().notNull().default(sql`'{}'::jsonb`),
    status: knowledgeDocStatusEnum("status").default("processing").notNull(),
    textStorageKey: varchar("text_storage_key", { length: 512 }).notNull(),
    failureReason: varchar("failure_reason", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    index("idx_knowledge_documents_user_id").on(table.userId),
    index("idx_knowledge_documents_status").on(table.status),
  ],
);

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: jsonb("embedding").$type<JsonObject>(),
  },
  (table) => [
    index("idx_knowledge_chunks_document").on(table.documentId),
    index("idx_knowledge_chunks_document_chunk").on(table.documentId, table.chunkIndex),
  ],
);

export const projectKnowledgeBindings = pgTable(
  "project_knowledge_bindings",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    boundAt: timestamp("bound_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.documentId],
      name: "project_knowledge_bindings_pk",
    }),
  ],
);
