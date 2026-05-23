/**
 * Planning Service
 * 负责创建和查询规划任务
 *
 * EARS-1: REQ-008-AC-001 创建 planning_jobs 记录
 */

// ---------------------------------------------------------------------------
// 目录布局
// ---------------------------------------------------------------------------
// lib/
// └── planning/
//     └── planning-service.ts    ← 本文件
// ---------------------------------------------------------------------------

import { eq, and, isNull, or, sql } from "drizzle-orm";

import { planningJobs } from "@/drizzle/schema/jobs";
import { projects } from "@/drizzle/schema/projects";
import { contentFiles } from "@/drizzle/schema/content-files";
import type { ContentFileType } from "@/drizzle/schema/enums";
import { getDb } from "@/lib/db";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import type { JobStatus } from "@/drizzle/schema/enums";

export type { JobStatus, ContentFileType } from "@/drizzle/schema/enums";

// ---------------------------------------------------------------------------
// 产出物类型
// ---------------------------------------------------------------------------

/**
 * Phase 2 规划产出的三文件
 */
export interface PlanningOutputFiles {
  characterFile: string; // "00-人物档案.md"
  outlineFile: string; // "01-大纲.md"
  writingPlanFile: string; // "02-写作计划.json"
}

// ---------------------------------------------------------------------------
// 创建规划任务
// ---------------------------------------------------------------------------

/**
 * 创建 Phase 2 规划任务记录
 *
 * 前置条件：
 * - 用户已完成 L3（标题已选）
 * - 项目处于 draft 或 planning 状态
 *
 * 行为：
 * - 在 planning_jobs 表中创建一条 pending 状态的记录
 * - 同一项目在 pending/running 状态下至多一条记录（应用层约束）
 *
 * @param projectId 项目 ID
 * @param userId 当前用户 ID
 * @returns 创建的任务记录
 */
export async function createPlanningJob(
  projectId: string,
  userId: string,
): Promise<{
  jobId: string;
  projectId: string;
  status: JobStatus;
}> {
  const database = getDb();

  // 校验项目归属
  await getProjectForUser(projectId, userId);

  // 检查是否已有 pending/running 状态的任务（应用层约束）
  const existingJobs = await database
    .select({ id: planningJobs.id })
    .from(planningJobs)
    .where(
      and(
        eq(planningJobs.projectId, projectId),
        or(
          eq(planningJobs.status, "pending"),
          eq(planningJobs.status, "running"),
        ),
        isNull(planningJobs.completedAt),
      ),
    )
    .limit(1);

  if (existingJobs.length > 0) {
    throw new Error("PLANNING_JOB_ALREADY_EXISTS");
  }

  // 创建新任务
  const [newJob] = await database
    .insert(planningJobs)
    .values({
      projectId,
      userId,
      status: "pending",
      attemptCount: 0,
    })
    .returning();

  return {
    jobId: newJob.id,
    projectId: newJob.projectId,
    status: newJob.status,
  };
}

// ---------------------------------------------------------------------------
// 查询规划任务状态
// ---------------------------------------------------------------------------

/**
 * 查询规划任务详情
 *
 * @param jobId 任务 ID
 * @param userId 当前用户 ID
 * @returns 任务记录（含错误信息）
 */
export async function getPlanningJobStatus(
  jobId: string,
  userId: string,
): Promise<{
  id: string;
  projectId: string;
  status: JobStatus;
  attemptCount: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
} | null> {
  const database = getDb();

  const [job] = await database
    .select({
      id: planningJobs.id,
      projectId: planningJobs.projectId,
      userId: planningJobs.userId,
      status: planningJobs.status,
      attemptCount: planningJobs.attemptCount,
      lastError: planningJobs.lastError,
      startedAt: planningJobs.startedAt,
      completedAt: planningJobs.completedAt,
      createdAt: planningJobs.createdAt,
    })
    .from(planningJobs)
    .where(eq(planningJobs.id, jobId))
    .limit(1);

  if (!job) {
    return null;
  }

  // 校验归属
  if (job.userId !== userId) {
    return null;
  }

  return {
    id: job.id,
    projectId: job.projectId,
    status: job.status,
    attemptCount: job.attemptCount,
    lastError: job.lastError,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
  };
}

/**
 * 查询项目最新的规划任务
 *
 * @param projectId 项目 ID
 * @param userId 当前用户 ID
 */
export async function getLatestPlanningJobForProject(
  projectId: string,
  userId: string,
): Promise<{
  id: string;
  projectId: string;
  status: JobStatus;
  attemptCount: number;
  lastError: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
} | null> {
  const database = getDb();

  // 校验项目归属
  await getProjectForUser(projectId, userId);

  const [job] = await database
    .select({
      id: planningJobs.id,
      projectId: planningJobs.projectId,
      status: planningJobs.status,
      attemptCount: planningJobs.attemptCount,
      lastError: planningJobs.lastError,
      startedAt: planningJobs.startedAt,
      completedAt: planningJobs.completedAt,
    })
    .from(planningJobs)
    .where(eq(planningJobs.projectId, projectId))
    .orderBy(planningJobs.createdAt)
    .limit(1);

  return job ?? null;
}

// ---------------------------------------------------------------------------
// Worker 辅助：更新任务状态
// ---------------------------------------------------------------------------

/**
 * 更新任务状态为 running（Worker 拉取时调用）
 */
export async function markJobRunning(
  jobId: string,
  lockedBy: string,
): Promise<void> {
  const database = getDb();
  await database
    .update(planningJobs)
    .set({
      status: "running",
      lockedAt: new Date(),
      lockedBy,
      startedAt: new Date(),
    })
    .where(eq(planningJobs.id, jobId));
}

/**
 * 更新任务状态为 completed
 */
export async function markJobCompleted(jobId: string): Promise<void> {
  const database = getDb();
  await database
    .update(planningJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(planningJobs.id, jobId));
}

/**
 * 更新任务状态为 failed
 */
export async function markJobFailed(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const database = getDb();
  await database
    .update(planningJobs)
    .set({
      status: "failed",
      lastError: errorMessage.slice(0, 1024),
      completedAt: new Date(),
    })
    .where(eq(planningJobs.id, jobId));
}

/**
 * 递增重试计数
 */
export async function incrementJobAttempt(jobId: string): Promise<number> {
  const database = getDb();
  const [updated] = await database
    .update(planningJobs)
    .set({
      attemptCount: sql`${planningJobs.attemptCount} + 1`,
    })
    .where(eq(planningJobs.id, jobId))
    .returning({ attemptCount: planningJobs.attemptCount });

  return updated?.attemptCount ?? 0;
}

// ---------------------------------------------------------------------------
// Worker 辅助：更新项目的 planning_ready 标志
// ---------------------------------------------------------------------------

/**
 * 设置项目的 planning_ready 标志为 true
 *
 * EARS-3: REQ-008-AC-007 planning_ready 标志
 */
export async function setProjectPlanningReady(
  projectId: string,
  userId: string,
): Promise<void> {
  const database = getDb();

  // 校验项目归属
  await getProjectForUser(projectId, userId);

  await database
    .update(projects)
    .set({
      planningReady: true,
    })
    .where(eq(projects.id, projectId));
}

// ---------------------------------------------------------------------------
// Worker 辅助：写入 content_files 索引
// ---------------------------------------------------------------------------

/**
 * 创建或更新 content_files 索引记录
 */
export async function upsertContentFileIndex(params: {
  projectId: string;
  fileType: ContentFileType;
  relativePath: string;
  chapterNumber?: number;
  title?: string;
  wordCount?: number;
}): Promise<void> {
  const database = getDb();

  await database
    .insert(contentFiles)
    .values({
      projectId: params.projectId,
      fileType: params.fileType,
      relativePath: params.relativePath,
      chapterNumber: params.chapterNumber ?? null,
      title: params.title ?? null,
      wordCount: params.wordCount ?? null,
    })
    .onConflictDoUpdate({
      target: [contentFiles.projectId, contentFiles.relativePath],
      set: {
        fileType: params.fileType,
        chapterNumber: params.chapterNumber ?? null,
        title: params.title ?? null,
        wordCount: params.wordCount ?? null,
        updatedAt: new Date(),
      },
    });
}