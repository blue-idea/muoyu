import { and, eq, isNull } from "drizzle-orm";

import { projects } from "../../drizzle/schema/projects";
import { getDb } from "./index";

export type ProjectRecord = typeof projects.$inferSelect;
export type ProjectLookup = (projectId: string, userId: string) => Promise<ProjectRecord | null>;

export function createProjectLookup(): ProjectLookup {
  return async (projectId: string, userId: string) => {
    const database = getDb();
    const matchedProjects = await database
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, userId), isNull(projects.deletedAt)),
      )
      .limit(1);

    const project = matchedProjects[0];
    return project ?? null;
  };
}

export async function getProjectForUser(
  projectId: string,
  userId: string,
  lookup: ProjectLookup = createProjectLookup(),
): Promise<ProjectRecord> {
  const project = await lookup(projectId, userId);
  if (project === null) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return project;
}

