/**
 * Editor Service
 *
 * EARS: REQ-013-AC-001/005/006 保存章节 + 字数越界警告可保存
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WORDS = 3000;
const MAX_WORDS = 5000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveChapterInput {
  projectId: string;
  userId: string;
  chapterNumber: number;
  content: string;
  confirmWordCountWarning?: boolean;
}

export interface SaveChapterOutput {
  success: true;
  wordCount: number;
  wordCountPass: boolean;
  warning?: string | null;
}

export interface SaveChapterError {
  success: false;
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

export function countChineseCharacters(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const chinesePunctuation = (text.match(/[\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const westernChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const westernPunctuation = (text.match(/[.,!?;:'"()\[\]{}—–-]/g) || []).length;
  return chineseChars + chinesePunctuation + westernChars + westernPunctuation;
}

export function isWordCountPass(wordCount: number): boolean {
  return wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
}

// ---------------------------------------------------------------------------
// 保存章节
// ---------------------------------------------------------------------------

/**
 * 保存章节内容到 R2
 *
 * EARS: REQ-013-AC-001 保存到 R2
 * EARS: REQ-013-AC-005 字数越界警告可保存
 * EARS: REQ-013-AC-006 保存后标记 wordCountPass
 */
export async function saveChapter(
  input: SaveChapterInput,
): Promise<SaveChapterOutput | SaveChapterError> {
  const { projectId, userId, chapterNumber, content, confirmWordCountWarning } = input;

  const db = getDb();
  const storage = createStorageDriver();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } };
  }

  const wordCount = countChineseCharacters(content);
  const passes = isWordCountPass(wordCount);

  const chapterFileName = `第${String(chapterNumber).padStart(2, "0")}章-.md`;
  const r2Key = `${project.storagePrefix}${chapterFileName}`;

  // 字数越界警告
  if (!passes && !confirmWordCountWarning) {
    return {
      success: true,
      wordCount,
      wordCountPass: false,
      warning: `Word count ${wordCount} is outside valid range (${MIN_WORDS}-${MAX_WORDS}). Please confirm to save anyway.`,
    };
  }

  // 保存到 R2
  await storage.writeText(r2Key, content);

  // 更新写作计划 JSON 中的 wordCountPass
  await updateWordCountPass(storage, project.storagePrefix, chapterNumber, passes);

  return { success: true, wordCount, wordCountPass: passes, warning: null };
}

// ---------------------------------------------------------------------------
// 更新 wordCountPass
// ---------------------------------------------------------------------------

async function updateWordCountPass(
  storage: ReturnType<typeof createStorageDriver>,
  storagePrefix: string,
  chapterNumber: number,
  wordCountPass: boolean,
): Promise<void> {
  const writingPlanKey = `${storagePrefix}02-写作计划.json`;

  try {
    const content = await storage.readText(writingPlanKey);
    const plan = JSON.parse(content) as {
      chapters: Array<{ chapterNumber: number; wordCountPass?: boolean | null; [key: string]: unknown }>;
    };

    const chapter = plan.chapters.find((ch) => ch.chapterNumber === chapterNumber);
    if (chapter) {
      chapter.wordCountPass = wordCountPass;
      await storage.writeText(writingPlanKey, JSON.stringify(plan, null, 2));
    }
  } catch {
    // 更新失败不影响章节保存
  }
}

// ---------------------------------------------------------------------------
// 读取章节
// ---------------------------------------------------------------------------

/**
 * 从 R2 读取章节内容
 */
export async function getChapterContent(
  projectId: string,
  _userId: string,
  chapterNumber: number,
): Promise<{ success: true; content: string } | SaveChapterError> {
  const db = getDb();
  const storage = createStorageDriver();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } };
  }

  const chapterFileName = `第${String(chapterNumber).padStart(2, "0")}章-.md`;
  const r2Key = `${project.storagePrefix}${chapterFileName}`;

  try {
    const content = await storage.readText(r2Key);
    return { success: true, content };
  } catch {
    return { success: false, error: { code: "STORAGE_IO_ERROR", message: "Failed to read chapter content." } };
  }
}