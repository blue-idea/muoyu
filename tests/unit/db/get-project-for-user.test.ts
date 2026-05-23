import { describe, expect, test, vi } from "vitest";

import {
  type ProjectLookup,
  type ProjectRecord,
  getProjectForUser,
} from "../../../lib/db/get-project-for-user";

function createProjectRecord(): ProjectRecord {
  const now = new Date("2026-05-23T00:00:00.000Z");

  return {
    id: "project-001",
    userId: "user-001",
    title: "Demo Project",
    slug: "demo-project",
    status: "draft",
    storagePrefix: "user-001/project-001-demo/",
    creationConfig: null,
    planningReady: false,
    llmConfigId: null,
    writingPlanEtag: null,
    chapterCompletedCount: 0,
    totalChapters: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    storageDeletePending: false,
  };
}

describe("getProjectForUser", () => {
  test("should return project when ownership matches", async () => {
    const project = createProjectRecord();
    const lookup: ProjectLookup = vi.fn(async () => project);

    const result = await getProjectForUser("project-001", "user-001", lookup);

    expect(result).toEqual(project);
    expect(lookup).toHaveBeenCalledWith("project-001", "user-001");
  });

  test("should throw project not found when lookup misses", async () => {
    const lookup: ProjectLookup = vi.fn(async () => null);

    await expect(getProjectForUser("project-001", "user-002", lookup)).rejects.toThrowError(
      "PROJECT_NOT_FOUND",
    );
  });
});

