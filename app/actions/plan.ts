"use server";

/**
 * Plan Server Actions (L4 - 规划确认与模式选择)
 *
 * EARS-1: REQ-009-AC-001 规划预览页前5章摘要
 * EARS-2: REQ-009-AC-002 全文折叠可展开
 * EARS-3: REQ-009-AC-003 知识库勾选
 * EARS-4: REQ-009-AC-004 serial/parallel + auto/manual 选择
 * EARS-5: REQ-009-AC-005 creationPace=auto → generation_jobs
 */
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { generationJobs } from "@/drizzle/schema/jobs";
import { projects } from "@/drizzle/schema/projects";
import { projectKnowledgeBindings } from "@/drizzle/schema/knowledge";
import { knowledgeDocuments } from "@/drizzle/schema/knowledge";
import { getDb } from "@/lib/db";
import { createStorageDriver } from "@/lib/storage";
import { getProjectService } from "@/lib/projects/project-service";
import type { WritingMode, CreationPace } from "@/drizzle/schema/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmPlanInput {
  projectId: string;
  writingMode: WritingMode;
  creationPace: CreationPace;
  boundKnowledgeDocIds?: string[];
}

export interface ConfirmPlanResult {
  success: true;
  redirectUrl: string;
}

export interface PlanPageData {
  projectId: string;
  projectTitle: string;
  totalChapters: number;
  storagePrefix: string;
  outlineContent: string;
  writingPlanContent: string;
  characterContent: string;
  boundKnowledgeDocs: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  allKnowledgeDocs: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "notFound",
  INVALID_STATE: "invalidState",
  SAVE_FAILED: "saveFailed",
} as const;

export type PlanError = {
  code: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const session = await auth();
  return requireUser(session);
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 获取 L4 规划确认页所需数据
 *
 * EARS-1: 前5章摘要 + 全文折叠可展开
 */
export async function getPlanPageData(
  projectId: string,
): Promise<{ success: true; data: PlanPageData } | { error: PlanError }> {
  const userId = await getAuthenticatedUser().catch(() => null);
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in.",
      },
    };
  }

  try {
    const db = getDb();
    const service = getProjectService();
    const storage = createStorageDriver();

    // 获取项目详情
    const project = await service.getProjectDetail(userId.id, projectId);

    // 读取 R2 上的规划文件
    let outlineContent = "";
    let writingPlanContent = "";
    let characterContent = "";

    try {
      outlineContent = await storage.readText(`${project.storagePrefix}01-大纲.md`);
    } catch {
      // 文件不存在时返回空
    }

    try {
      writingPlanContent = await storage.readText(`${project.storagePrefix}02-写作计划.json`);
    } catch {
      // 文件不存在时返回空
    }

    try {
      characterContent = await storage.readText(`${project.storagePrefix}00-人物档案.md`);
    } catch {
      // 文件不存在时返回空
    }

    // 获取已绑定的知识库文档
    const boundBindings = await db
      .select({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        status: knowledgeDocuments.status,
      })
      .from(projectKnowledgeBindings)
      .innerJoin(
        knowledgeDocuments,
        eq(knowledgeDocuments.id, projectKnowledgeBindings.documentId),
      )
      .where(eq(projectKnowledgeBindings.projectId, projectId));

    // 获取用户所有可用的知识库文档（用于勾选）
    const allDocs = await db
      .select({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        status: knowledgeDocuments.status,
      })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.userId, userId.id),
          eq(knowledgeDocuments.status, "ready"),
        ),
      );

    // 解析写作计划获取总章数
    let totalChapters = 0;
    try {
      const plan = JSON.parse(writingPlanContent);
      totalChapters = plan.totalChapters ?? 0;
    } catch {
      totalChapters = 0;
    }

    return {
      success: true,
      data: {
        projectId: project.id,
        projectTitle: project.title,
        totalChapters,
        storagePrefix: project.storagePrefix,
        outlineContent,
        writingPlanContent,
        characterContent,
        boundKnowledgeDocs: boundBindings,
        allKnowledgeDocs: allDocs,
      },
    };
  } catch (err) {
    console.error("[getPlanPageData] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to load plan data.",
      },
    };
  }
}

/**
 * 确认规划，选择写作模式与创作节奏
 *
 * EARS-4: REQ-009-AC-004 serial/parallel + auto/manual 选择
 * EARS-5: REQ-009-AC-005 creationPace=auto → generation_jobs
 */
export async function confirmPlan(
  input: ConfirmPlanInput,
): Promise<ConfirmPlanResult | { error: PlanError }> {
  const userId = await getAuthenticatedUser().catch(() => null);
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in.",
      },
    };
  }

  try {
    const db = getDb();
    const service = getProjectService();

    // 验证项目存在且属于当前用户
    const project = await service.getProjectDetail(userId.id, input.projectId);

    // 仅在 planning 状态下可确认
    if (project.status !== "planning") {
      return {
        error: {
          code: ERROR_CODES.INVALID_STATE,
          message: "Project is not in planning state.",
        },
      };
    }

    // 读取现有写作计划文件
    const storage = createStorageDriver();
    let writingPlanContent = "";
    try {
      writingPlanContent = await storage.readText(
        `${project.storagePrefix}02-写作计划.json`,
      );
    } catch {
      return {
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: "Writing plan file not found.",
        },
      };
    }

    // 解析并更新写作计划
    let writingPlan: Record<string, unknown>;
    try {
      writingPlan = JSON.parse(writingPlanContent);
    } catch {
      return {
        error: {
          code: ERROR_CODES.SAVE_FAILED,
          message: "Invalid writing plan file.",
        },
      };
    }

    // 更新写作模式与创作节奏
    writingPlan.writingMode = input.writingMode;
    writingPlan.creationPace = input.creationPace;
    writingPlan.status = "in_progress";

    // 写回 R2
    await storage.writeText(
      `${project.storagePrefix}02-写作计划.json`,
      JSON.stringify(writingPlan, null, 2),
    );

    // EARS-5: creationPace=auto 时创建 generation_jobs 记录
    if (input.creationPace === "auto") {
      // 检查是否已存在 pending/running 的 generation_job
      const existingJobs = await db
        .select({ id: generationJobs.id })
        .from(generationJobs)
        .where(
          and(
            eq(generationJobs.projectId, input.projectId),
            eq(generationJobs.status, "pending"),
          ),
        )
        .limit(1);

      if (existingJobs.length === 0) {
        await db.insert(generationJobs).values({
          projectId: input.projectId,
          userId: userId.id,
          status: "pending",
          attemptCount: 0,
          // initialChapter 由 worker 读取 writingPlan.currentChapter 或第一个 pending
        });
      }
    }

    // 更新项目状态为 writing
    await db
      .update(projects)
      .set({
        status: "writing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.userId, userId.id),
        ),
      );

    // REQ-015-AC-003: 知识库绑定（先删后增）
    if (input.boundKnowledgeDocIds) {
      // 移除旧绑定
      await db
        .delete(projectKnowledgeBindings)
        .where(eq(projectKnowledgeBindings.projectId, input.projectId));

      // 添加新绑定
      for (const docId of input.boundKnowledgeDocIds) {
        await db.insert(projectKnowledgeBindings).values({
          projectId: input.projectId,
          documentId: docId,
        }).onConflictDoNothing();
      }
    }

    return {
      success: true,
      redirectUrl: `/projects/${input.projectId}/write`,
    };
  } catch (err) {
    console.error("[confirmPlan] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to confirm plan.",
      },
    };
  }
}

/**
 * 获取前 N 章摘要（用于 L4 预览）
 *
 * EARS-1: 前5章摘要
 */
export async function getChapterSummaries(
  projectId: string,
  limit = 5,
): Promise<
  | {
      success: true;
      summaries: Array<{
        chapterNumber: number;
        title: string;
        summary: string;
      }>;
    }
  | { error: PlanError }
> {
  const userId = await getAuthenticatedUser().catch(() => null);
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in.",
      },
    };
  }

  try {
    const service = getProjectService();
    const project = await service.getProjectDetail(userId.id, projectId);
    const storage = createStorageDriver();

    let outlineContent = "";
    try {
      outlineContent = await storage.readText(`${project.storagePrefix}01-大纲.md`);
    } catch {
      return { success: true, summaries: [] };
    }

    // 解析章节摘要（从大纲文件中提取前 N 章摘要）
    // 大纲格式：### 第N章：标题\n**摘要**：（内容）
    const summaries: Array<{ chapterNumber: number; title: string; summary: string }> =
      [];

    const lines = outlineContent.split("\n");
    let currentChapter = 0;
    let currentTitle = "";
    let inSummaryBlock = false;
    let summaryBuffer = "";

    for (const line of lines) {
      // 匹配章节标题行：### 第N章：标题
      const chapterMatch = line.match(/^###\s+第(\d+)章[：:]\s*(.+)/);
      if (chapterMatch) {
        // 保存上一章摘要
        if (currentChapter > 0 && summaryBuffer.length > 0) {
          summaries.push({
            chapterNumber: currentChapter,
            title: currentTitle,
            summary: summaryBuffer.trim(),
          });
          if (summaries.length >= limit) break;
        }

        currentChapter = parseInt(chapterMatch[1], 10);
        currentTitle = chapterMatch[2].trim();
        inSummaryBlock = false;
        summaryBuffer = "";
        continue;
      }

      // 匹配摘要行：**摘要**：（内容）  或  **摘要**：
      const summaryLineMatch = line.match(/^\*\*摘要\*\*[：:]\s*(.*)/);
      if (summaryLineMatch) {
        inSummaryBlock = true;
        summaryBuffer = summaryLineMatch[1];
        continue;
      }

      // 在摘要块内继续积累内容（直到遇到下一个 ### 标题或其他大标题）
      if (inSummaryBlock && line.trim().length > 0) {
        // 检查是否到达下一个章节或大节
        if (line.startsWith("## ") || line.startsWith("### 第")) {
          inSummaryBlock = false;
        } else {
          summaryBuffer += "\n" + line;
        }
      }
    }

    // 保存最后一章
    if (currentChapter > 0 && summaryBuffer.length > 0 && summaries.length < limit) {
      summaries.push({
        chapterNumber: currentChapter,
        title: currentTitle,
        summary: summaryBuffer.trim(),
      });
    }

    return { success: true, summaries };
  } catch (err) {
    console.error("[getChapterSummaries] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to load chapter summaries.",
      },
    };
  }
}