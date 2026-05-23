/**
 * Planning Worker
 * 消费 planning_jobs 队列，生成 Phase 2 规划产物
 *
 * EARS-2: REQ-008-AC-005 Worker 生成 00/01/02 文件
 * EARS-3: REQ-008-AC-007 planning_ready 标志
 *
 * 技术约束：
 * - 通过数据库轮询消费任务（不使用消息队列）
 * - 所有文件写入 Cloudflare R2
 * - 完成后设置 projects.planning_ready=true
 */

// ---------------------------------------------------------------------------
// 目录布局
// ---------------------------------------------------------------------------
// lib/
// └── worker/
//     └── planning-worker.ts    ← 本文件
// ---------------------------------------------------------------------------

import { eq, and, isNull, or, asc, sql } from "drizzle-orm";

import { planningJobs } from "@/drizzle/schema/jobs";
import { projects } from "@/drizzle/schema/projects";
import { getDb } from "@/lib/db";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createStorageDriver } from "@/lib/storage";
import type { StorageDriver } from "@/lib/storage/types";

import {
  setProjectPlanningReady,
  upsertContentFileIndex,
  type PlanningOutputFiles,
} from "@/lib/planning/planning-service";

// ---------------------------------------------------------------------------
// Worker 实例标识
// ---------------------------------------------------------------------------

/**
 * Worker 实例 ID，用于分布式锁
 * 实际部署时使用主机名或容器 ID
 */
export function getWorkerId(): string {
  if (typeof process !== "undefined" && process.env.HOSTNAME) {
    return process.env.HOSTNAME;
  }
  return `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// 锁机制
// ---------------------------------------------------------------------------

/**
 * 尝试锁定任务（分布式互斥）
 *
 * @returns true 表示获取锁成功，false 表示任务已被其他 Worker 锁定
 */
async function tryAcquireLock(jobId: string, workerId: string): Promise<boolean> {
  const database = getDb();

  const result = await database
    .update(planningJobs)
    .set({
      status: "running",
      lockedAt: new Date(),
      lockedBy: workerId,
      startedAt: new Date(),
    })
    .where(
      and(
        eq(planningJobs.id, jobId),
        or(
          eq(planningJobs.status, "pending"),
          eq(planningJobs.status, "running"),
        ),
        isNull(planningJobs.lockedAt),
      ),
    );

  return (result.rowCount ?? 0) > 0;
}

/**
 * 释放任务锁
 */
async function releaseLock(jobId: string): Promise<void> {
  const database = getDb();
  await database
    .update(planningJobs)
    .set({
      status: "pending",
      lockedAt: sql`NULL`,
      lockedBy: sql`NULL`,
    })
    .where(eq(planningJobs.id, jobId));
}

// ---------------------------------------------------------------------------
// 轮询待处理任务
// ---------------------------------------------------------------------------

/**
 * 获取一条待处理的规划任务
 * 按创建时间升序，避免长时间饥饿
 */
async function fetchPendingJob(): Promise<{
  id: string;
  projectId: string;
  userId: string;
} | null> {
  const database = getDb();

  const [job] = await database
    .select({
      id: planningJobs.id,
      projectId: planningJobs.projectId,
      userId: planningJobs.userId,
    })
    .from(planningJobs)
    .where(
      and(
        eq(planningJobs.status, "pending"),
        isNull(planningJobs.lockedAt),
        isNull(planningJobs.completedAt),
      ),
    )
    .orderBy(asc(planningJobs.createdAt))
    .limit(1);

  return job ?? null;
}

// ---------------------------------------------------------------------------
// Phase 2 产物生成（占位实现）
// ---------------------------------------------------------------------------

/**
 * 生成人物档案文件
 *
 * EARS-2: REQ-008-AC-005 生成 00-人物档案.md
 *
 * @param storage 存储驱动
 * @param storagePrefix R2 对象键前缀
 * @param projectId 项目 ID
 * @param userId 用户 ID
 * @param creationConfig 创作配置
 */
async function generateCharacterFile(
  storage: StorageDriver,
  storagePrefix: string,
  projectId: string,
  userId: string,
  creationConfig: Record<string, unknown>,
): Promise<{ relativePath: string; title: string }> {
  const relativePath = "00-人物档案.md";
  const r2Key = `${storagePrefix}${relativePath}`;

  // TODO: 后续集成 LLM 生成真实内容
  // 当前占位实现：生成结构化占位符内容
  const genre =
    (creationConfig?.layer1 as { genre?: string } | undefined)?.genre ?? "未设定";
  const protagonist = (
    creationConfig?.layer1 as {
      protagonist?: { type?: string; name?: string };
    } | undefined
  )?.protagonist;

  const content = `# 人物档案

## 基本信息
- 项目ID：${projectId}
- 用户ID：${userId}
- 题材：${genre}

## 主角

### 类型
${protagonist?.type ?? "待补充"}

### 核心性格
待补充

### 背景故事
待补充

### 口吻特征
待补充

### 性格缺陷
待补充

## 关键配角
待补充

## 反派
待补充

> **占位说明**：此文件由 Planning Worker 自动生成，内容待 AI 填充。
`;

  await storage.writeText(r2Key, content);

  return { relativePath, title: "人物档案" };
}

/**
 * 生成章节大纲文件
 *
 * EARS-2: REQ-008-AC-005 生成 01-大纲.md
 *
 * @param storage 存储驱动
 * @param storagePrefix R2 对象键前缀
 * @param projectId 项目 ID
 * @param totalChapters 总章节数
 */
async function generateOutlineFile(
  storage: StorageDriver,
  storagePrefix: string,
  projectId: string,
  totalChapters: number,
): Promise<{ relativePath: string; title: string }> {
  const relativePath = "01-大纲.md";
  const r2Key = `${storagePrefix}${relativePath}`;

  // TODO: 后续集成 LLM 生成真实大纲（7 列表格）
  const chapterRows = Array.from({ length: totalChapters }, (_, i) => {
    const chapterNum = i + 1;
    const chapterNumStr = String(chapterNum).padStart(2, "0");
    return `| 第${chapterNumStr}章 | 第${chapterNumStr}章 | 待补充核心事件 | 待补充 | 待补充 | 待补充 | 待补充 | 待补充 |`;
  }).join("\n");

  const content = `# 大纲

## 基本信息
- 项目ID：${projectId}
- 总章节数：${totalChapters}

## 章节规划

| 章节 | 标题 | 核心事件 | 承接上章 | 章首引子类型 | 悬念钩子 | 出场人物 | 场景列表 |
${chapterRows}

## 全书悬念线
待补充

## 章节摘要
${Array.from({ length: totalChapters }, (_, i) => {
    const chapterNum = i + 1;
    const chapterNumStr = String(chapterNum).padStart(2, "0");
    return `### 第${chapterNumStr}章：第${chapterNumStr}章\n\n**摘要**：待补充\n`;
  }).join("\n")}

> **占位说明**：此文件由 Planning Worker 自动生成，内容待 AI 填充。
`;

  await storage.writeText(r2Key, content);

  return { relativePath, title: "大纲" };
}

/**
 * 生成写作计划 JSON 文件
 *
 * EARS-2: REQ-008-AC-005 生成 02-写作计划.json
 *
 * @param storage 存储驱动
 * @param storagePrefix R2 对象键前缀
 * @param projectId 项目 ID
 * @param title 小说标题
 * @param totalChapters 总章节数
 */
async function generateWritingPlanFile(
  storage: StorageDriver,
  storagePrefix: string,
  projectId: string,
  title: string,
  totalChapters: number,
): Promise<{ relativePath: string; title: string }> {
  const relativePath = "02-写作计划.json";
  const r2Key = `${storagePrefix}${relativePath}`;

  // 生成章节列表
  const chapters = Array.from({ length: totalChapters }, (_, i) => {
    const chapterNum = i + 1;
    const chapterNumStr = String(chapterNum).padStart(2, "0");
    return {
      chapterNumber: chapterNum,
      title: `第${chapterNumStr}章`,
      filePath: `第${chapterNumStr}章-第${chapterNumStr}章.md`,
      status: "pending",
      wordCount: null,
      wordCountPass: null,
      retryCount: 0,
    };
  });

  const writingPlan = {
    version: 1,
    novelName: title,
    projectPath: storagePrefix,
    totalChapters,
    minWordsPerChapter: 3000,
    maxWordsPerChapter: 5000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "planning",
    writingMode: "serial",
    creationPace: "auto",
    chapters,
  };

  await storage.writeText(r2Key, JSON.stringify(writingPlan, null, 2));

  return { relativePath, title: "写作计划" };
}

// ---------------------------------------------------------------------------
// 执行规划任务
// ---------------------------------------------------------------------------

/**
 * 执行单个规划任务
 *
 * @param jobId 任务 ID
 * @param projectId 项目 ID
 * @param userId 用户 ID
 */
async function executePlanningJob(
  jobId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  const database = getDb();
  const storage = createStorageDriver();

  // 1. 获取项目信息
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const storagePrefix = project.storagePrefix;
  const title = project.title;
  const creationConfig =
    (project.creationConfig as Record<string, unknown>) ?? {};
  const totalChapters = project.totalChapters ?? 20;

  // 2. 生成三文件
  const [characterFile, outlineFile, writingPlanFile] = await Promise.all([
    generateCharacterFile(
      storage,
      storagePrefix,
      projectId,
      userId,
      creationConfig,
    ),
    generateOutlineFile(storage, storagePrefix, projectId, totalChapters),
    generateWritingPlanFile(
      storage,
      storagePrefix,
      projectId,
      title,
      totalChapters,
    ),
  ]);

  // 3. 创建 content_files 索引记录
  await Promise.all([
    upsertContentFileIndex({
      projectId,
      fileType: "character",
      relativePath: characterFile.relativePath,
      title: characterFile.title,
    }),
    upsertContentFileIndex({
      projectId,
      fileType: "outline",
      relativePath: outlineFile.relativePath,
      title: outlineFile.title,
    }),
    upsertContentFileIndex({
      projectId,
      fileType: "writing_plan",
      relativePath: writingPlanFile.relativePath,
      title: writingPlanFile.title,
    }),
  ]);

  // 4. 设置 planning_ready=true
  await setProjectPlanningReady(projectId, userId);

  // 5. 更新项目状态为 planning（如果当前是 draft）
  if (project.status === "draft") {
    await database
      .update(projects)
      .set({ status: "planning" })
      .where(eq(projects.id, projectId));
  }
}

// ---------------------------------------------------------------------------
// Worker 主循环
// ---------------------------------------------------------------------------

/**
 * 单次轮询循环
 * 尝试获取并执行一条待处理任务
 */
export async function pollOnce(): Promise<boolean> {
  const workerId = getWorkerId();

  // 1. 获取待处理任务
  const pendingJob = await fetchPendingJob();
  if (!pendingJob) {
    return false; // 无任务
  }

  // 2. 尝试获取锁
  const lockAcquired = await tryAcquireLock(pendingJob.id, workerId);
  if (!lockAcquired) {
    return false; // 锁被占用，跳过
  }

  try {
    // 3. 执行任务
    await executePlanningJob(pendingJob.id, pendingJob.projectId, pendingJob.userId);

    // 4. 标记完成
    await markPlanningJobCompleted(pendingJob.id);

    return true;
  } catch (error) {
    // 5. 处理失败
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markPlanningJobFailed(pendingJob.id, errorMessage);
    await incrementPlanningJobAttempt(pendingJob.id);
    return false;
  } finally {
    // 6. 释放锁
    await releaseLock(pendingJob.id);
  }
}

/**
 * 启动 Worker 主循环
 *
 * @param intervalMs 轮询间隔（毫秒）
 * @param maxIterations 最大迭代次数（0 表示无限）
 */
export async function runWorker(
  intervalMs: number = 5000,
  maxIterations: number = 0,
): Promise<void> {
  let iterations = 0;

  while (true) {
    if (maxIterations > 0 && iterations >= maxIterations) {
      break;
    }

    await pollOnce();
    iterations++;

    if (intervalMs > 0) {
      await sleep(intervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Worker 内部辅助
// ---------------------------------------------------------------------------

async function markPlanningJobCompleted(jobId: string): Promise<void> {
  const database = getDb();
  await database
    .update(planningJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
    })
    .where(eq(planningJobs.id, jobId));
}

async function markPlanningJobFailed(
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

async function incrementPlanningJobAttempt(jobId: string): Promise<number> {
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
// 导出规划产物文件路径常量
// ---------------------------------------------------------------------------

export const PLANNING_OUTPUT_FILES: PlanningOutputFiles = {
  characterFile: "00-人物档案.md",
  outlineFile: "01-大纲.md",
  writingPlanFile: "02-写作计划.json",
};