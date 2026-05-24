/**
 * Chapter Writer Service
 *
 * 单章创作子流程
 * EARS: REQ-010-AC-001~006
 * - 字数 3000-5000，MAX_RETRY=3
 * - 创作前注入知识库片段（RAG）
 * - 写完 R2-first，然后更新 DB
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { generationJobs } from "@/drizzle/schema/jobs";
import { eq } from "drizzle-orm";
import { getLLMClientForUser } from "@/lib/ai/llm-router";
import { knowledgeChunks, projectKnowledgeBindings } from "@/drizzle/schema/knowledge";
import { getChapterRAGContext } from "@/lib/rag/rag-service";
import type { LLMClient } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_WORDS = 3000;
const MAX_WORDS = 5000;
const MAX_RETRY = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteChapterInput {
  projectId: string;
  userId: string;
  chapterNumber: number;
  outline: OutlineRow;
  previousChapterSummary?: string;
  userInstruction?: string;
}

export interface WriteChapterOutput {
  success: true;
  content: string;
  wordCount: number;
  wordCountPass: boolean;
  retryCount: number;
}

export interface WriteChapterError {
  success: false;
  error: { code: string; message: string };
}

export interface OutlineRow {
  chapterNumber: number;
  title: string;
  coreEvent?: string; // 核心事件（用于 RAG 检索关键词）
  scene: string;
  plot: string;
  characters: string;
  setting: string;
  theme: string;
}

export interface WritingPlan {
  chapters: ChapterPlanItem[];
}

export interface ChapterPlanItem {
  chapterNumber: number;
  title: string;
  summary: string;
  wordCount?: number;
  wordCountPass?: boolean;
  status: string;
}

export interface ChapterContext {
  previousChapterSummary?: string;
  characterProfiles: string;
  worldSetting: string;
  ragContext?: string;
}

// ---------------------------------------------------------------------------
// 公开函数
// ---------------------------------------------------------------------------

/**
 * 统计中文字符数
 */
export function countChineseCharacters(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const chinesePunctuation = (text.match(/[\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const westernChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const westernPunctuation = (text.match(/[.,!?;:'"()\[\]{}—–-]/g) || []).length;
  return chineseChars + chinesePunctuation + westernChars + westernPunctuation;
}

/**
 * 字数是否达标
 */
export function isWordCountPass(wordCount: number): boolean {
  return wordCount >= MIN_WORDS && wordCount <= MAX_WORDS;
}

/**
 * 格式化章号
 */
export function formatChapterNumber(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * 写入章节（单章创作子流程）
 *
 * EARS-1: REQ-010-AC-001 单章子流程入口
 * EARS-2: REQ-010-AC-002 知识库 RAG 注入
 * EARS-3: REQ-010-AC-003 字数 3000-5000，MAX_RETRY=3
 * EARS-4: REQ-010-AC-004/005 扩充/压缩策略
 * EARS-5: REQ-010-AC-006 R2-first then DB
 */
export async function writeChapter(
  input: WriteChapterInput,
): Promise<WriteChapterOutput | WriteChapterError> {
  const { projectId, userId, chapterNumber, outline, previousChapterSummary, userInstruction } = input;

  const db = getDb();
  const storage = createStorageDriver();

  // 获取项目信息
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return {
      success: false,
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found." },
    };
  }

  // 读取上下文（人物档案、大纲）
  const context = await buildChapterContext(
    storage,
    project.storagePrefix,
    previousChapterSummary,
  );

  // 获取用户 LLM 客户端（用户配置优先）
  let llm: LLMClient;
  try {
    llm = await getLLMClientForUser(userId, projectId);
  } catch {
    return {
      success: false,
      error: { code: "LLM_CONFIG_ERROR", message: "Failed to initialize LLM client." },
    };
  }

  // 获取知识库 RAG 片段
  const ragResult = await getChapterRAGContext(projectId, chapterNumber, outline.title, outline.coreEvent);
  if (ragResult) {
    context.ragContext = ragResult.context;
  }

  // 构建创作 prompt
  const prompt = buildChapterPrompt(outline, context, userInstruction);

  // 重试循环
  let retryCount = 0;
  let content = "";
  let expandNeeded = false;
  let compressNeeded = false;

  do {
    retryCount++;

    // 生成章节内容
    const generated = await generateChapterWithLLM(llm, prompt, outline.title);

    if (generated.trim().length < 100) {
      if (retryCount >= MAX_RETRY) {
        return {
          success: false,
          error: { code: "LLM_GENERATION_FAILED", message: "Chapter generation failed after max retries." },
        };
      }
      continue;
    }

    content = generated;
    const wordCount = countChineseCharacters(content);

    // 检查字数
    if (wordCount < MIN_WORDS) {
      expandNeeded = true;
      const expandPrompt = buildExpandPrompt(content, outline, prompt);
      const expanded = await generateChapterWithLLM(llm, expandPrompt, outline.title);
      content = expanded;
    } else if (wordCount > MAX_WORDS) {
      compressNeeded = true;
      const compressPrompt = buildCompressPrompt(content, outline);
      const compressed = await generateChapterWithLLM(llm, compressPrompt, outline.title);
      content = compressed;
    }
  } while (retryCount < MAX_RETRY && (expandNeeded || compressNeeded));

  const wordCount = countChineseCharacters(content);
  const passes = isWordCountPass(wordCount);

  // R2-first：先写入 R2
  const chapterFileName = `第${formatChapterNumber(chapterNumber)}章-.md`;
  const r2Key = `${project.storagePrefix}${chapterFileName}`;
  await storage.writeText(r2Key, content);

  // 然后更新 DB（generation_job）
  await db
    .update(generationJobs)
    .set({
      status: passes ? "completed" : "failed",
      completedAt: new Date(),
    })
    .where(eq(generationJobs.projectId, projectId));

  return {
    success: true,
    content,
    wordCount,
    wordCountPass: passes,
    retryCount,
  };
}

// ---------------------------------------------------------------------------
// 内部函数
// ---------------------------------------------------------------------------

/**
 * 构建章节创作的上下文
 */
async function buildChapterContext(
  storage: ReturnType<typeof createStorageDriver>,
  storagePrefix: string,
  previousChapterSummary?: string,
): Promise<ChapterContext> {
  let characterProfiles = "";
  const worldSetting = "";
  let outline = "";

  try {
    characterProfiles = await storage.readText(`${storagePrefix}00-人物档案.md`);
  } catch {
    // 人物档案不存在
  }

  try {
    outline = await storage.readText(`${storagePrefix}01-大纲.md`);
  } catch {
    // 大纲不存在
  }

  return {
    previousChapterSummary: previousChapterSummary || "",
    characterProfiles,
    worldSetting: outline,
  };
}

/**
 * 获取知识库 RAG 上下文
 *
 * EARS: REQ-015-AC-003 知识库绑定后检索片段
 */
async function getRAGContext(
  db: ReturnType<typeof getDb>,
  projectId: string,
  chapterNumber: number,
): Promise<string | undefined> {
  // 查询项目绑定的知识库文档
  const bindings = await db
    .select({ documentId: projectKnowledgeBindings.documentId })
    .from(projectKnowledgeBindings)
    .where(eq(projectKnowledgeBindings.projectId, projectId));

  if (bindings.length === 0) return undefined;

  const documentIds = bindings.map((b) => b.documentId);

  // 读取前 3 个 chunk
  const chunks = await db
    .select({ content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, documentIds[0]))
    .limit(3);

  if (chunks.length === 0) return undefined;

  return chunks.map((c) => c.content).join("\n\n");
}

/**
 * 构建章节创作 prompt
 */
function buildChapterPrompt(
  outline: OutlineRow,
  context: ChapterContext,
  userInstruction?: string,
): string {
  const lines: string[] = [];

  lines.push(`你是网络小说作者，请根据以下大纲写第 ${outline.chapterNumber} 章。`);
  lines.push("");
  lines.push(`【章节标题】${outline.title}`);
  lines.push(`【场景】${outline.scene}`);
  lines.push(`【情节】${outline.plot}`);
  lines.push(`【出场人物】${outline.characters}`);
  lines.push(`【设定】${outline.setting}`);
  lines.push(`【主题】${outline.theme}`);
  lines.push("");

  if (context.previousChapterSummary) {
    lines.push(`【前章摘要】${context.previousChapterSummary}`);
    lines.push("");
  }

  if (context.characterProfiles) {
    lines.push(`【人物档案】${context.characterProfiles}`);
    lines.push("");
  }

  if (context.ragContext) {
    lines.push(`【参考知识】${context.ragContext}`);
    lines.push("");
  }

  if (userInstruction) {
    lines.push(`【作者指令】${userInstruction}`);
    lines.push("");
  }

  lines.push("请写出一章完整内容（约 3000-5000 字），直接输出正文，不要加标题前缀。");

  return lines.join("\n");
}

/**
 * 构建扩充 prompt
 */
function buildExpandPrompt(
  currentContent: string,
  outline: OutlineRow,
  originalPrompt: string,
): string {
  const wordCount = countChineseCharacters(currentContent);
  return [
    `当前章节字数 ${wordCount}，不足 3000 字。请扩充内容。`,
    `【章节标题】${outline.title}`,
    "",
    "扩充要求：",
    "1. 增加细节描写（场景、人物动作、心理）",
    "2. 增加对话和冲突",
    "3. 保持情节连贯",
    "",
    `【当前内容】${currentContent.slice(0, 500)}...`,
    "",
    "请输出扩充后的完整正文。",
  ].join("\n");
}

/**
 * 构建压缩 prompt
 */
function buildCompressPrompt(
  currentContent: string,
  outline: OutlineRow,
): string {
  return [
    `请压缩以下章节内容，保留核心情节，控制在 5000 字以内。`,
    `【章节标题】${outline.title}`,
    "",
    `【当前内容】${currentContent}`,
    "",
    "请输出压缩后的完整正文。",
  ].join("\n");
}

/**
 * 调用 LLM 生成章节
 */
async function generateChapterWithLLM(
  llm: LLMClient,
  prompt: string,
  title: string,
): Promise<string> {
  try {
    const response = await llm.chat({
      messages: [{ role: "user", content: prompt }],
      model: "unknown", // 由 llm client 内部路由
    });

    return response.content || "";
  } catch (err) {
    console.error("LLM generation error:", err);
    return "";
  }
}