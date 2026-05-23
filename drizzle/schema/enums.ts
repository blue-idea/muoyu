import { pgEnum } from "drizzle-orm/pg-core";

export type ProjectStatus = "draft" | "planning" | "writing" | "validating" | "completed";
export const projectStatusEnumValues: [
  ProjectStatus,
  ...ProjectStatus[],
] = ["draft", "planning", "writing", "validating", "completed"];
export const projectStatusEnum = pgEnum("project_status", projectStatusEnumValues);

export type ContentFileType = "character" | "outline" | "writing_plan" | "chapter";
export const contentFileTypeEnumValues: [
  ContentFileType,
  ...ContentFileType[],
] = ["character", "outline", "writing_plan", "chapter"];
export const contentFileTypeEnum = pgEnum("content_file_type", contentFileTypeEnumValues);

export type ChapterStatus = "pending" | "in_progress" | "completed" | "failed";
export const chapterStatusEnumValues: [
  ChapterStatus,
  ...ChapterStatus[],
] = ["pending", "in_progress", "completed", "failed"];
export const chapterStatusEnum = pgEnum("chapter_status", chapterStatusEnumValues);

export type CreationPace = "auto" | "manual";
export const creationPaceEnumValues: [CreationPace, ...CreationPace[]] = ["auto", "manual"];
export const creationPaceEnum = pgEnum("creation_pace", creationPaceEnumValues);

export type WritingMode = "serial" | "parallel";
export const writingModeEnumValues: [WritingMode, ...WritingMode[]] = ["serial", "parallel"];
export const writingModeEnum = pgEnum("writing_mode", writingModeEnumValues);

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export const jobStatusEnumValues: [JobStatus, ...JobStatus[]] = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
];
export const jobStatusEnum = pgEnum("job_status", jobStatusEnumValues);

export type KnowledgeDocStatus = "processing" | "ready" | "failed";
export const knowledgeDocStatusEnumValues: [
  KnowledgeDocStatus,
  ...KnowledgeDocStatus[],
] = ["processing", "ready", "failed"];
export const knowledgeDocStatusEnum = pgEnum("knowledge_doc_status", knowledgeDocStatusEnumValues);

export type KnowledgeSourceType = "upload" | "url";
export const knowledgeSourceTypeEnumValues: [
  KnowledgeSourceType,
  ...KnowledgeSourceType[],
] = ["upload", "url"];
export const knowledgeSourceTypeEnum = pgEnum("knowledge_source_type", knowledgeSourceTypeEnumValues);

export type ExportFormat = "md" | "txt" | "pdf" | "epub";
export const exportFormatEnumValues: [ExportFormat, ...ExportFormat[]] = [
  "md",
  "txt",
  "pdf",
  "epub",
];
export const exportFormatEnum = pgEnum("export_format", exportFormatEnumValues);
