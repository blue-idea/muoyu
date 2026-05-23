import { describe, expect, test } from "vitest";

import {
  chapterStatusEnumValues,
  contentFileTypeEnumValues,
  creationPaceEnumValues,
  jobStatusEnumValues,
  knowledgeDocStatusEnumValues,
  projectStatusEnumValues,
  writingModeEnumValues,
} from "../../../drizzle/schema/enums";
import { accounts, sessions, users, verificationTokens } from "../../../drizzle/schema/auth";
import { contentFiles } from "../../../drizzle/schema/content-files";
import { exportRecords } from "../../../drizzle/schema/exports";
import { generationJobs, planningJobs } from "../../../drizzle/schema/jobs";
import {
  knowledgeChunks,
  knowledgeDocuments,
  projectKnowledgeBindings,
} from "../../../drizzle/schema/knowledge";
import { userLlmConfigs } from "../../../drizzle/schema/llm";
import { userPreferences } from "../../../drizzle/schema/preferences";
import { projects } from "../../../drizzle/schema/projects";

describe("drizzle schema baseline", () => {
  test("should expose expected enum values", () => {
    expect(projectStatusEnumValues).toEqual([
      "draft",
      "planning",
      "writing",
      "validating",
      "completed",
    ]);
    expect(contentFileTypeEnumValues).toEqual(["character", "outline", "writing_plan", "chapter"]);
    expect(jobStatusEnumValues).toEqual(["pending", "running", "completed", "failed", "cancelled"]);
    expect(creationPaceEnumValues).toEqual(["auto", "manual"]);
    expect(writingModeEnumValues).toEqual(["serial", "parallel"]);
    expect(chapterStatusEnumValues).toEqual(["pending", "in_progress", "completed", "failed"]);
    expect(knowledgeDocStatusEnumValues).toEqual(["processing", "ready", "failed"]);
  });

  test("should export all tables required by TASK-002", () => {
    expect(users).toBeDefined();
    expect(accounts).toBeDefined();
    expect(sessions).toBeDefined();
    expect(verificationTokens).toBeDefined();

    expect(userPreferences).toBeDefined();
    expect(projects).toBeDefined();
    expect(contentFiles).toBeDefined();
    expect(planningJobs).toBeDefined();
    expect(generationJobs).toBeDefined();

    expect(userLlmConfigs).toBeDefined();
    expect(knowledgeDocuments).toBeDefined();
    expect(knowledgeChunks).toBeDefined();
    expect(projectKnowledgeBindings).toBeDefined();
    expect(exportRecords).toBeDefined();
  });
});
