"use server";

/**
 * Writing Server Actions
 *
 * 手动创作模式核心 Action
 * EARS: REQ-010-AC-010~014
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { getDb } from "@/lib/db";
import { createStorageDriver } from "@/lib/storage";
import { writeChapter, formatChapterNumber, type WriteChapterOutput, type WriteChapterError } from "@/lib/writing/chapter-writer";



import { OUTLINE_FILE_NAME, PLANNING_FILE_NAME } from "@/config/paths";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateChapterInput {
  projectId: string;
  chapterNumber: number;
}

export type GenerateChapterResult =
  | { ok: true; chapterNumber: number; wordCount: number; wordCountPass: boolean }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  INVALID_PROJECT_STATUS: "INVALID_PROJECT_STATUS",
  INVALID_MODE: "INVALID_MODE",
  CHAPTER_ORDER_VIOLATION: "CHAPTER_ORDER_VIOLATION",
  GENERATION_FAILED: "GENERATION_FAILED",
} as const;

// ---------------------------------------------------------------------------
// generateChapter
// ---------------------------------------------------------------------------

/**
 * 手动模式生成单章
 *
 * 校验:
 * - creationPace === 'manual'
 * - chapterNumber === 当前最小 pending/failed 序号
 *
 * 行为:
 * - 调用 chapter-writer.ts 的 writeChapter
 * - 不自动下一章（仅更新当前章状态）
 */
export async function generateChapter(
  input: GenerateChapterInput,
): Promise<GenerateChapterResult> {
  // 1. 鉴权
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 2. 归属校验
  let project;
  try {
    project = await getProjectForUser(input.projectId, userId);
  } catch {
    return {
      ok: false,
      error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: "Project not found." },
    };
  }

  const _db = getDb();
  const storage = createStorageDriver();
  const storagePrefix = project.storagePrefix;

  // 3. 检查项目状态（必须是 writing）
  if (project.status !== "writing") {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_PROJECT_STATUS,
        message: "Project is not in writing status.",
      },
    };
  }

  // 4. 读取写作计划，校验 creationPace === 'manual'
  let writingPlan: {
    writingMode: string;
    creationPace: string;
    chapters: Array<{
      chapterNumber: number;
      title: string;
      status: string;
      wordCount?: number | null;
      wordCountPass?: boolean | null;
      filePath?: string;
    }>;
  };

  try {
    const planContent = await storage.readText(`${storagePrefix}${PLANNING_FILE_NAME}`);
    writingPlan = JSON.parse(planContent);
  } catch {
    return {
      ok: false,
      error: { code: ERROR_CODES.INVALID_MODE, message: "Failed to load writing plan." },
    };
  }

  if (writingPlan.creationPace !== "manual") {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_MODE,
        message: "This action is only available in manual writing mode.",
      },
    };
  }

  // 5. 找到当前最小 pending/failed 序号
  const pendingOrFailed = writingPlan.chapters
    .filter((c) => c.status === "pending" || c.status === "failed")
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (pendingOrFailed.length === 0) {
    return {
      ok: false,
      error: { code: ERROR_CODES.INVALID_MODE, message: "No pending chapters to generate." },
    };
  }

  const currentChapter = pendingOrFailed[0].chapterNumber;

  // 6. 跳章校验
  if (input.chapterNumber !== currentChapter) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.CHAPTER_ORDER_VIOLATION,
        message: `Chapter ${input.chapterNumber} cannot be generated before completing chapter ${currentChapter}.`,
      },
    };
  }

  // 7. 读取本章大纲行
  const outlineRows: Array<{
    chapterNumber: number;
    title: string;
    scene: string;
    plot: string;
    characters: string;
    setting: string;
    theme: string;
  }> = [];

  try {
    const outlineContent = await storage.readText(`${storagePrefix}${OUTLINE_FILE_NAME}`);
    // 解析 "### 第NN章：title" 行
    const lines = outlineContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^\| 第(\d+)章 \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/);
      if (match) {
        outlineRows.push({
          chapterNumber: parseInt(match[1], 10),
          title: match[2].trim(),
          scene: match[3].trim(),
          plot: match[4].trim(),
          characters: match[5].trim(),
          setting: match[6].trim(),
          theme: match[7].trim(),
        });
      }
    }
  } catch {
    // 大纲读取失败不影响执行，使用空 outline
  }

  const currentOutline = outlineRows.find((r) => r.chapterNumber === input.chapterNumber) ?? {
    chapterNumber: input.chapterNumber,
    title: `Chapter ${input.chapterNumber}`,
    scene: "",
    plot: "",
    characters: "",
    setting: "",
    theme: "",
  };

  // 8. 前章摘要（找前一章已完成章节的 wordCount）
  const previousChapter = writingPlan.chapters.find(
    (c) => c.chapterNumber === input.chapterNumber - 1,
  );

  // 9. 调用 writeChapter
  let writeResult: WriteChapterOutput | WriteChapterError;

  try {
    writeResult = await writeChapter({
      projectId: input.projectId,
      userId,
      chapterNumber: input.chapterNumber,
      outline: currentOutline,
      previousChapterSummary: previousChapter ? `前章字数：${previousChapter.wordCount ?? 0}` : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chapter generation failed.";
    return {
      ok: false,
      error: { code: ERROR_CODES.GENERATION_FAILED, message: msg },
    };
  }

  if (!writeResult.success) {
    return {
      ok: false,
      error: { code: writeResult.error.code, message: writeResult.error.message },
    };
  }

  const { content, wordCount, wordCountPass } = writeResult;

  // 10. 写 R2 章节文件
  const chapterFileName = `第${formatChapterNumber(input.chapterNumber)}章-${currentOutline.title}.md`;
  const chapterR2Key = `${storagePrefix}${chapterFileName}`;

  try {
    await storage.writeText(chapterR2Key, content);
  } catch {
    // 写入失败不阻断流程，content 已在 writeResult 中
  }

  // 11. 更新写作计划：该章 status → completed + wordCount
  const updatedChapters = writingPlan.chapters.map((c) =>
    c.chapterNumber === input.chapterNumber
      ? { ...c, status: wordCountPass ? "completed" : "failed", wordCount, wordCountPass }
      : c,
  );

  try {
    await storage.writeText(
      `${storagePrefix}${PLANNING_FILE_NAME}`,
      JSON.stringify({ ...writingPlan, chapters: updatedChapters }, null, 2),
    );
  } catch {
    // 更新失败不阻断返回
  }

  // 12. 追加章节摘要到 01-大纲.md
  try {
    const summaryText = `\n### 第${formatChapterNumber(input.chapterNumber)}章：${currentOutline.title}\n\n**摘要**：${content.slice(0, 300)}...\n`;
    const outlineContent = await storage.readText(`${storagePrefix}${OUTLINE_FILE_NAME}`);
    await storage.writeText(`${storagePrefix}${OUTLINE_FILE_NAME}`, outlineContent + summaryText);
  } catch {
    // 摘要追加失败不阻断返回
  }

  return {
    ok: true,
    chapterNumber: input.chapterNumber,
    wordCount,
    wordCountPass,
  };
}
