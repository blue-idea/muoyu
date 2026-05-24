/**
 * Generation Worker
 *
 * EARS: REQ-010-AC-007 自动创作 Worker + 进度轮询 API
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { generationJobs } from "@/drizzle/schema/jobs";
import { projects } from "@/drizzle/schema/projects";
import { eq, and, isNull } from "drizzle-orm";
import { writeChapter } from "@/lib/writing/chapter-writer";
import type { OutlineRow } from "@/lib/writing/chapter-writer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

/**
 * 运行自动创作 Worker
 *
 * EARS-1: REQ-010-AC-007 扫描 pending jobs 并处理
 */
export async function runGenerationWorker(): Promise<WorkerResult> {
  const db = getDb();

  // 查找所有 pending 状态的 job（serial 模式一次一个，parallel 模式可多个）
  const pendingJobs = await db
    .select({
      id: generationJobs.id,
      projectId: generationJobs.projectId,
      userId: generationJobs.userId,
      currentChapterNumber: generationJobs.currentChapterNumber,
      status: generationJobs.status,
    })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.status, "pending"),
        isNull(generationJobs.lockedAt),
      ),
    )
    .limit(5);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of pendingJobs) {
    processed++;

    // 尝试获取锁（防止并发）
    const lockResult = await db
      .update(generationJobs)
      .set({ lockedAt: new Date() })
      .where(
        and(
          eq(generationJobs.id, job.id),
          isNull(generationJobs.lockedAt),
        ),
      );

    if (!lockResult) continue; // 获取锁失败，跳过

    try {
      // 读取项目信息
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, job.projectId))
        .limit(1);

      if (!project) {
        errors.push(`Project not found for job ${job.id}`);
        failed++;
        continue;
      }

      // 读取大纲（从 R2）
      const storage = createStorageDriver();
      const planKey = `${project.storagePrefix}02-写作计划.json`;
      const planContent = await storage.readText(planKey);
      const plan = JSON.parse(planContent) as { chapters: OutlineRow[] };

      const chapterOutline = plan.chapters.find(
        (ch) => ch.chapterNumber === job.currentChapterNumber,
      );

      if (!chapterOutline) {
        errors.push(`Chapter ${job.currentChapterNumber} outline not found`);
        failed++;
        continue;
      }

      // 写入章节
      if (job.currentChapterNumber == null) {
        errors.push('Job ' + job.id + ': currentChapterNumber is null');
        failed++;
        continue;
      }

      const result = await writeChapter({
        projectId: job.projectId,
        userId: job.userId,
        chapterNumber: job.currentChapterNumber,
        outline: chapterOutline,
      });

      if (result.success) {
        succeeded++;
        // 更新 job 状态
        await db
          .update(generationJobs)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(generationJobs.id, job.id));
      } else {
        failed++;
        errors.push(`Job ${job.id} failed: ${result.error.message}`);
        await db
          .update(generationJobs)
          .set({
            status: "failed",
            completedAt: new Date(),
          })
          .where(eq(generationJobs.id, job.id));
      }
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : "Unknown error";
      errors.push(`Job ${job.id} exception: ${message}`);
    }
  }

  return { processed, succeeded, failed, errors };
}