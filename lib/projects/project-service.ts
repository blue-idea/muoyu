/**
 * Project Service
 *
 * EARS-2: REQ-002-AC-001 仅展示当前用户作品
 * EARS-3: REQ-002-AC-004 越权访问拒绝
 * EARS-4: REQ-002-AC-007 draft 项目点击跳转向导（不是新建）
 * EARS-5: REQ-002-AC-002 writing 状态展示续写入口 + 章节进度
 * EARS-6: REQ-002-AC-005 planning 状态展示"继续确认规划"入口
 */
import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { getProjectForUser, type ProjectRecord } from "@/lib/db/get-project-for-user";
import { projects } from "@/drizzle/schema/projects";
import { createStorageDriver } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectStatus = "draft" | "planning" | "writing" | "validating" | "completed";

export interface ProjectListItem {
  id: string;
  title: string;
  slug: string;
  status: ProjectStatus;
  planningReady: boolean;
  chapterCompletedCount: number;
  totalChapters: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDetail {
  id: string;
  title: string;
  slug: string;
  status: ProjectStatus;
  planningReady: boolean;
  storagePrefix: string;
  chapterCompletedCount: number;
  totalChapters: number | null;
  creationConfig: Record<string, unknown> | null;
  llmConfigId: string | null;
  writingPlanEtag: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 五态路由映射
 * - draft      → /projects/[projectId]/wizard（向导继续）
 * - planning   → /projects/[projectId]/planning（规划页）
 * - writing    → /projects/[projectId]/write（创作进度）
 * - validating → /projects/[projectId]/complete（校验进度）
 * - completed  → /projects/[projectId]/read（阅读器）
 */
export type StatusRouteMap = {
  [K in ProjectStatus]: string;
};

export const STATUS_TO_ROUTE: StatusRouteMap = {
  draft: "/projects/[projectId]/wizard",
  planning: "/projects/[projectId]/planning",
  writing: "/projects/[projectId]/write",
  validating: "/projects/[projectId]/complete",
  completed: "/projects/[projectId]/read",
};

/** 获取项目跳转 href（不含实际 projectId 替换，需在 UI 层处理） */
export function getProjectResumeRoute(project: ProjectListItem): string {
  if (project.status === "draft") {
    return `/projects/${project.id}/wizard`;
  }
  if (project.status === "planning" && !project.planningReady) {
    return `/projects/${project.id}/planning`;
  }
  if (project.status === "planning" && project.planningReady) {
    return `/projects/${project.id}/planning`;
  }
  if (project.status === "writing") {
    return `/projects/${project.id}/write`;
  }
  if (project.status === "validating") {
    return `/projects/${project.id}/complete`;
  }
  if (project.status === "completed") {
    return `/projects/${project.id}/read`;
  }
  return `/projects/${project.id}/wizard`;
}

// ---------------------------------------------------------------------------
// ProjectService
// ---------------------------------------------------------------------------

export class ProjectService {
  /**
   * 创建项目
   * - 分配 storage_prefix
   * - 默认 draft 状态
   */
  async createProject(userId: string, title: string, slug: string): Promise<ProjectRecord> {
    const db = getDb();

    const [project] = await db
      .insert(projects)
      .values({
        userId,
        title,
        slug,
        status: "draft",
        storagePrefix: `${userId}/${slug}/`,
        planningReady: false,
        chapterCompletedCount: 0,
      })
      .returning();

    return project;
  }

  /**
   * 删除项目
   * - Q6 软删流程（先软删 DB → 再删 R2 对象 → storage_delete_pending 补偿）
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const db = getDb();

    // 1. 获取项目确认归属
    const project = await getProjectForUser(projectId, userId);

    // 2. 软删 DB
    await db
      .update(projects)
      .set({ deletedAt: new Date(), storageDeletePending: true })
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

    // 3. 删除 R2 对象前缀
    const storage = createStorageDriver();
    try {
      await storage.deletePrefix(project.storagePrefix);
      // 4. 清除补偿标记
      await db
        .update(projects)
        .set({ storageDeletePending: false })
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    } catch {
      // R2 删除失败，保留 storage_delete_pending 标记供 Worker 补偿重试
      // 不抛出异常，避免阻塞 DB 软删
    }
  }

  /**
   * 获取用户所有项目（仪表盘列表）
   * EARS-2: REQ-002-AC-001 仅展示当前用户作品
   */
  async getProjectsForDashboard(userId: string): Promise<ProjectListItem[]> {
    const db = getDb();

    const rows = await db
      .select({
        id: projects.id,
        title: projects.title,
        slug: projects.slug,
        status: projects.status,
        planningReady: projects.planningReady,
        chapterCompletedCount: projects.chapterCompletedCount,
        totalChapters: projects.totalChapters,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.updatedAt));

    return rows.map((row) => ({
      ...row,
      status: row.status as ProjectStatus,
    }));
  }

  /**
   * 获取项目详情
   * 元数据不含正文
   */
  async getProjectDetail(
    userId: string,
    projectId: string,
  ): Promise<ProjectDetail> {
    // EARS-3: REQ-002-AC-004 越权访问拒绝
    const project = await getProjectForUser(projectId, userId);

    return {
      id: project.id,
      title: project.title,
      slug: project.slug,
      status: project.status as ProjectStatus,
      planningReady: project.planningReady,
      storagePrefix: project.storagePrefix,
      chapterCompletedCount: project.chapterCompletedCount,
      totalChapters: project.totalChapters,
      creationConfig: project.creationConfig as Record<string, unknown> | null,
      llmConfigId: project.llmConfigId,
      writingPlanEtag: project.writingPlanEtag,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

let _instance: ProjectService | null = null;

export function getProjectService(): ProjectService {
  if (_instance === null) {
    _instance = new ProjectService();
  }
  return _instance;
}