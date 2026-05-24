/**
 * Editor Service
 *
 * EARS: REQ-013
 * - AC-001/005/006 保存章节 + 字数越界警告可保存
 * - AC-002/003 全书/单章一致性检查
 * - AC-004 AI 润色 + diff + 接受后保存
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import { getLLMClientForUser } from "@/lib/ai/llm-router";
import { PROFILE_FILE_NAME, OUTLINE_FILE_NAME, PLANNING_FILE_NAME } from "@/config/paths";
import { countChineseCharacters, isWordCountPass } from "@/lib/writing/chapter-writer";

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
// Consistency Check Types
// ---------------------------------------------------------------------------

export interface ConsistencyIssue {
  chapterNumber?: number;
  dimension: "character" | "plot" | "setting" | "suspense";
  severity: "P0" | "P1" | "P2";
  description: string;
  location?: string;
}

export interface ConsistencyCheckInput {
  projectId: string;
  userId: string;
  scope: "book" | "chapter";
  chapterNumber?: number;
}

export interface ConsistencyCheckOutput {
  success: true;
  issues: ConsistencyIssue[];
}

// ---------------------------------------------------------------------------
// Polish Types
// ---------------------------------------------------------------------------

export interface PolishInput {
  projectId: string;
  userId: string;
  chapterNumber: number;
  selection?: { start: number; end: number };
}

export interface PolishOutput {
  success: true;
  diff: string;
  polishedContent: string;
}

export interface AcceptPolishInput {
  projectId: string;
  userId: string;
  chapterNumber: number;
  content: string;
  confirmWordCountWarning?: boolean;
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
  const { projectId, chapterNumber, content, confirmWordCountWarning } = input;

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

  // 注意：文件路径格式为 "第NN章-{title}.md"
  // 实际写入时使用无标题占位符，chapter-writer.ts 会写入完整标题
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
  const writingPlanKey = `${storagePrefix}${PLANNING_FILE_NAME}`;

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

// ---------------------------------------------------------------------------
// 一致性检查
// ---------------------------------------------------------------------------

/**
 * 运行一致性检查（全书或单章）
 *
 * EARS: REQ-013-AC-002 全书一致性检查
 * EARS: REQ-013-AC-003 单章一致性检查
 *
 * 检查维度：
 * - 人物一致性：性格、口吻、能力边界
 * - 情节连贯：大纲、前章摘要、伏笔
 * - 设定一致：世界观、时间线
 * - 悬念承接：上章钩子与本章回应
 */
export async function runConsistencyCheck(
  input: ConsistencyCheckInput,
): Promise<ConsistencyCheckOutput | SaveChapterError> {
  const { projectId, userId, scope, chapterNumber } = input;

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

  const storagePrefix = project.storagePrefix;
  const issues: ConsistencyIssue[] = [];

  // 读取人物档案和大纲
  const [characterContent, outlineContent] = await Promise.all([
    safeReadText(storage, `${storagePrefix}${PROFILE_FILE_NAME}`),
    safeReadText(storage, `${storagePrefix}${OUTLINE_FILE_NAME}`),
  ]);

  // 获取写作计划，确定要检查的章节范围
  const writingPlanContent = await safeReadText(storage, `${storagePrefix}${PLANNING_FILE_NAME}`);
  let writingPlan: { chapters: Array<{ chapterNumber: number; title: string; status: string }> };
  try {
    writingPlan = JSON.parse(writingPlanContent);
  } catch {
    return { success: false, error: { code: "WRITING_PLAN_CORRUPTED", message: "Writing plan JSON is corrupted." } };
  }

  // 获取用户 LLM 客户端
  let llm;
  try {
    llm = await getLLMClientForUser(userId, projectId);
  } catch {
    return { success: false, error: { code: "LLM_CONFIG_ERROR", message: "Failed to initialize LLM client." } };
  }

  if (scope === "chapter" && chapterNumber !== undefined) {
    // 单章检查：检查当前章与设定及前后章衔接
    const chapterContent = await safeReadText(
      storage,
      `${storagePrefix}第${String(chapterNumber).padStart(2, "0")}章-.md`,
    );

    const previousChapterContent = chapterNumber > 1
      ? await safeReadText(storage, `${storagePrefix}第${String(chapterNumber - 1).padStart(2, "0")}章-.md`)
      : null;

    const chapterIssues = await checkChapterConsistency(
      llm,
      chapterNumber,
      chapterContent || "",
      previousChapterContent || "",
      outlineContent || "",
      characterContent || "",
    );

    issues.push(...chapterIssues);
  } else {
    // 全书检查：逐章检查
    const chaptersToCheck = writingPlan.chapters.filter((c) => c.status === "completed");

    for (const chapter of chaptersToCheck) {
      const chapterContent = await safeReadText(
        storage,
        `${storagePrefix}第${String(chapter.chapterNumber).padStart(2, "0")}章-.md`,
      );

      const previousChapterContent = chapter.chapterNumber > 1
        ? await safeReadText(
            storage,
            `${storagePrefix}第${String(chapter.chapterNumber - 1).padStart(2, "0")}章-.md`,
          )
        : null;

      const chapterIssues = await checkChapterConsistency(
        llm,
        chapter.chapterNumber,
        chapterContent || "",
        previousChapterContent || "",
        outlineContent || "",
        characterContent || "",
      );

      // 标记章号
      for (const issue of chapterIssues) {
        issue.chapterNumber = chapter.chapterNumber;
      }
      issues.push(...chapterIssues);
    }
  }

  return { success: true, issues };
}

/**
 * 检查单章一致性
 */
async function checkChapterConsistency(
  llm: Awaited<ReturnType<typeof getLLMClientForUser>>,
  chapterNumber: number,
  chapterContent: string,
  previousChapterContent: string | null,
  outlineContent: string,
  characterContent: string,
): Promise<ConsistencyIssue[]> {
  const prompt = buildConsistencyCheckPrompt(
    chapterNumber,
    chapterContent,
    previousChapterContent,
    outlineContent,
    characterContent,
  );

  try {
    const response = await llm.chat({
      messages: [{ role: "user", content: prompt }],
    });

    return parseConsistencyIssues(response.content || "", chapterNumber);
  } catch {
    return [];
  }
}

/**
 * 构建一致性检查 prompt
 */
function buildConsistencyCheckPrompt(
  chapterNumber: number,
  chapterContent: string,
  previousChapterContent: string | null,
  outlineContent: string,
  characterContent: string,
): string {
  const lines: string[] = [];

  lines.push(`你是小说质量审核员，请检查第 ${chapterNumber} 章的一致性问题。`);
  lines.push("");
  lines.push("【检查维度】");
  lines.push("1. 人物一致性：性格、口吻、能力边界是否与档案一致");
  lines.push("2. 情节连贯：是否符合大纲、本章摘要和伏笔");
  lines.push("3. 设定一致：世界观、时间线是否矛盾");
  lines.push("4. 悬念承接：上章钩子是否在本章回应");
  lines.push("");
  lines.push("【人物档案】");
  lines.push(characterContent || "(无)");
  lines.push("");
  lines.push("【大纲】");
  lines.push(outlineContent || "(无)");
  lines.push("");
  lines.push("【前章内容】");
  lines.push(previousChapterContent || "(无前章)");
  lines.push("");
  lines.push("【本章内容】");
  lines.push(chapterContent || "(无)");
  lines.push("");
  lines.push("请以 JSON 数组格式输出发现的问题，每项包含：");
  lines.push("- dimension: character|plot|setting|suspense");
  lines.push("- severity: P0|P1|P2");
  lines.push("- description: 问题描述");
  lines.push("- location: 问题位置（可选）");
  lines.push("如无问题，返回空数组 []。");

  return lines.join("\n");
}

/**
 * 解析一致性检查结果
 */
function parseConsistencyIssues(rawOutput: string, chapterNumber: number): ConsistencyIssue[] {
  try {
    // 尝试提取 JSON 数组
    const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const issues = JSON.parse(jsonMatch[0]) as Array<{
        dimension: string;
        severity: string;
        description: string;
        location?: string;
      }>;

      return issues.map((issue) => ({
        chapterNumber,
        dimension: issue.dimension as ConsistencyIssue["dimension"],
        severity: issue.severity as ConsistencyIssue["severity"],
        description: issue.description,
        location: issue.location,
      }));
    }
  } catch {
    // 解析失败，尝试简单解析
  }

  return [];
}

// ---------------------------------------------------------------------------
// AI 润色
// ---------------------------------------------------------------------------

/**
 * 润色整章或选中片段
 *
 * EARS: REQ-013-AC-004
 * - 展示修改前后 diff
 * - 仅在用户明确接受后持久化
 */
export async function polishChapter(
  input: PolishInput,
): Promise<PolishOutput | SaveChapterError> {
  const { projectId, userId, chapterNumber, selection } = input;

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

  // 读取章节内容
  const chapterFileName = `第${String(chapterNumber).padStart(2, "0")}章-.md`;
  const r2Key = `${project.storagePrefix}${chapterFileName}`;

  let originalContent: string;
  try {
    originalContent = await storage.readText(r2Key);
  } catch {
    return { success: false, error: { code: "STORAGE_IO_ERROR", message: "Failed to read chapter content." } };
  }

  // 根据 selection 提取目标文本
  const targetContent = selection
    ? originalContent.slice(selection.start, selection.end)
    : originalContent;

  // 获取用户 LLM 客户端
  let llm;
  try {
    llm = await getLLMClientForUser(userId, projectId);
  } catch {
    return { success: false, error: { code: "LLM_CONFIG_ERROR", message: "Failed to initialize LLM client." } };
  }

  // 生成润色内容
  const polishedContent = await generatePolishedContent(llm, targetContent, !!selection);

  // 生成 diff
  const diff = generateDiff(targetContent, polishedContent);

  return {
    success: true,
    diff,
    polishedContent,
  };
}

/**
 * 生成润色内容
 */
async function generatePolishedContent(
  llm: Awaited<ReturnType<typeof getLLMClientForUser>>,
  content: string,
  _isSelection: boolean,
): Promise<string> {
  const lines: string[] = [];

  lines.push("你是网络小说润色专家，请对以下内容进行深度润色。");
  lines.push("");
  lines.push("【润色要求】");
  lines.push("1. 去除 AI 生成痕迹（过于完美的句式、过度使用的连接词）");
  lines.push("2. 增强对话自然度和人物特色");
  lines.push("3. 提升场景描写的画面感");
  lines.push("4. 保持原有情节和人物设定");
  lines.push("5. 增加适当的悬念和张力");
  lines.push("");
  lines.push("【待润色内容】");
  lines.push(content);
  lines.push("");
  lines.push("请直接输出润色后的内容，不要加任何前缀说明。");

  const prompt = lines.join("\n");

  try {
    const response = await llm.chat({
      messages: [{ role: "user", content: prompt }],
    });

    return response.content || content;
  } catch {
    return content;
  }
}

/**
 * 生成简单的文本 diff
 * 格式：
 * - [+] 新增行
 * - [-] 删除行
 * - [~] 修改行（原内容 → 新内容）
 */
function generateDiff(original: string, polished: string): string {
  const originalLines = original.split("\n");
  const polishedLines = polished.split("\n");
  const diffLines: string[] = [];

  // 简单的行级 diff
  const maxLines = Math.max(originalLines.length, polishedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const origLine = originalLines[i];
    const polyLine = polishedLines[i];

    if (origLine === undefined) {
      diffLines.push(`[+] ${polyLine}`);
    } else if (polyLine === undefined) {
      diffLines.push(`[-] ${origLine}`);
    } else if (origLine !== polyLine) {
      if (origLine.trim() && polyLine.trim()) {
        diffLines.push(`[~] ${origLine} → ${polyLine}`);
      } else if (polyLine.trim()) {
        diffLines.push(`[+] ${polyLine}`);
      } else if (origLine.trim()) {
        diffLines.push(`[-] ${origLine}`);
      }
    }
  }

  return diffLines.join("\n");
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 安全读取文本，失败返回空字符串
 */
async function safeReadText(
  storage: ReturnType<typeof createStorageDriver>,
  key: string,
): Promise<string> {
  try {
    return await storage.readText(key);
  } catch {
    return "";
  }
}