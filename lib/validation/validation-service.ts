/**
 * Validation Service
 *
 * EARS: REQ-011-AC-001~006 Phase 4 全书校验
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import { isWordCountPass } from "@/lib/writing/chapter-writer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  chapterNumber: number;
  type: "wordCount" | "consistency" | "plot";
  severity: "high" | "medium" | "low";
  description: string;
}

export interface ValidationReport {
  projectId: string;
  totalChapters: number;
  passedChapters: number;
  failedChapters: number;
  issues: ValidationIssue[];
  allPassed: boolean;
}

// ---------------------------------------------------------------------------
// 主函数
// ---------------------------------------------------------------------------

/**
 * 校验单章
 *
 * EARS: REQ-011-AC-001 单章校验
 */
export async function validateChapter(
  projectId: string,
  chapterNumber: number,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const storage = createStorageDriver();
  const db = getDb();

  // 获取项目信息
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return issues;

  // 读取章节内容
  const chapterFileName = `第${String(chapterNumber).padStart(2, "0")}章-.md`;
  let content = "";
  try {
    content = await storage.readText(`${project.storagePrefix}${chapterFileName}`);
  } catch {
    issues.push({
      chapterNumber,
      type: "plot",
      severity: "high",
      description: `Chapter file not found: ${chapterFileName}`,
    });
    return issues;
  }

  // 字数校验
  const wordCount = countChineseCharacters(content);
  if (!isWordCountPass(wordCount)) {
    issues.push({
      chapterNumber,
      type: "wordCount",
      severity: "high",
      description: `Word count ${wordCount} is outside valid range (3000-5000)`,
    });
  }

  // 简化一致性检查
  if (content.length < 100) {
    issues.push({
      chapterNumber,
      type: "consistency",
      severity: "medium",
      description: "Chapter content is suspiciously short",
    });
  }

  return issues;
}

/**
 * 运行全书校验
 *
 * EARS: REQ-011-AC-002/003 全书校验
 */
export async function runFullValidation(
  projectId: string,
): Promise<ValidationReport> {
  const issues: ValidationIssue[] = [];

  const storage = createStorageDriver();
  const db = getDb();

  // 获取项目信息
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return {
      projectId,
      totalChapters: 0,
      passedChapters: 0,
      failedChapters: 0,
      issues: [],
      allPassed: false,
    };
  }

  // 读取写作计划
  let plan: { chapters: Array<{ chapterNumber: number; status: string }> } | null = null;
  try {
    const planContent = await storage.readText(
      `${project.storagePrefix}02-写作计划.json`,
    );
    plan = JSON.parse(planContent);
  } catch {
    // 无法读取写作计划
  }

  if (!plan) {
    return {
      projectId,
      totalChapters: 0,
      passedChapters: 0,
      failedChapters: 0,
      issues: [],
      allPassed: false,
    };
  }

  const completedChapters = plan.chapters.filter(
    (ch) => ch.status === "completed",
  );

  // 逐章校验
  for (const chapter of completedChapters) {
    const chapterIssues = await validateChapter(projectId, chapter.chapterNumber);
    issues.push(...chapterIssues);
  }

  const failedChapters = new Set(issues.map((i) => i.chapterNumber)).size;
  const passedChapters = completedChapters.length - failedChapters;

  return {
    projectId,
    totalChapters: completedChapters.length,
    passedChapters,
    failedChapters,
    issues,
    allPassed: failedChapters === 0,
  };
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function countChineseCharacters(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const chinesePunctuation = (text.match(/[\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const westernChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const westernPunctuation = (text.match(/[.,!?;:'"()\[\]{}—–-]/g) || []).length;
  return chineseChars + chinesePunctuation + westernChars + westernPunctuation;
}