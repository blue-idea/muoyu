/**
 * RAG Service
 *
 * 知识库检索增强生成：从绑定文档中检索相关片段并注入 LLM 上下文
 * EARS: REQ-015-AC-003~006
 */

import { getDb } from "@/lib/db";
import {
  projectKnowledgeBindings,
  knowledgeChunks,
  knowledgeDocuments,
} from "@/drizzle/schema/knowledge";
import { contentFiles } from "@/drizzle/schema/content-files";
import { eq, and, inArray, gte } from "drizzle-orm";
import { searchDocumentContent } from "@/lib/knowledge/knowledge-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RAGContextOptions {
  /** 最多返回多少个 chunk 片段 */
  maxChunks?: number;
  /** 每个 chunk 的最大字符数 */
  maxChunkChars?: number;
}

export interface RAGContextResult {
  /** 检索到的文本片段（拼接后） */
  context: string;
  /** 涉及的文档 ID 列表 */
  documentIds: string[];
  /** 每个片段的来源信息（用于可追溯展示） */
  sources: Array<{
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    snippet: string;
  }>;
}

// ---------------------------------------------------------------------------
// Core RAG retrieval
// ---------------------------------------------------------------------------

/**
 * 构建章节 RAG 检索关键词
 *
 * 从章节大纲标题和核心事件中提取关键词，用于检索相关知识片段
 */
function buildChapterKeywords(
  chapterTitle: string,
  coreEvent?: string,
): string[] {
  const keywords: string[] = [];

  // 从标题提取关键词（去除停用词）
  const stopWords = new Set(["第", "章", "的", "了", "在", "是", "和", "与", "及", "或", "为", "于"]);
  const words = chapterTitle.split(/[\s,\-，。、]+/);

  for (const word of words) {
    const cleaned = word.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
    if (cleaned.length >= 2 && !stopWords.has(cleaned)) {
      keywords.push(cleaned);
    }
  }

  // 从核心事件补充关键词
  if (coreEvent) {
    const eventWords = coreEvent.split(/[\s,\-，。、]+/);
    for (const w of eventWords) {
      const cleaned = w.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");
      if (cleaned.length >= 2 && !stopWords.has(cleaned) && !keywords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }
  }

  return keywords.slice(0, 5); // 最多 5 个关键词
}

/**
 * 检查 chunk 是否与章节相关
 *
 * 基于关键词重叠度判断 Relevance
 */
function isChunkRelevant(chunk: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;

  const chunkLower = chunk.toLowerCase();
  let matchCount = 0;

  for (const keyword of keywords) {
    if (chunkLower.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  // 至少匹配 1 个关键词
  return matchCount >= 1;
}

/**
 * 为章节检索 RAG 上下文
 *
 * EARS: REQ-015-AC-003 检索片段纳入 Phase 3 生成
 */
export async function getChapterRAGContext(
  projectId: string,
  chapterNumber: number,
  chapterTitle: string,
  coreEvent?: string,
  options: RAGContextOptions = {},
): Promise<RAGContextResult | null> {
  const db = getDb();
  const { maxChunks = 5, maxChunkChars = 1500 } = options;

  // 1. 获取项目绑定的文档列表
  const bindings = await db
    .select({ documentId: projectKnowledgeBindings.documentId })
    .from(projectKnowledgeBindings)
    .where(eq(projectKnowledgeBindings.projectId, projectId));

  if (bindings.length === 0) {
    return null;
  }

  const documentIds = bindings.map((b) => b.documentId);

  // 2. 获取这些文档的标题（用于可追溯）
  const docs = await db
    .select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title })
    .from(knowledgeDocuments)
    .where(inArray(knowledgeDocuments.id, documentIds));

  const docTitleMap = new Map(docs.map((d) => [d.id, d.title]));

  // 3. 构建检索关键词
  const keywords = buildChapterKeywords(chapterTitle, coreEvent);

  // 4. 从每个文档检索相关 chunks
  const allSources: RAGContextResult["sources"] = [];

  for (const documentId of documentIds) {
    // 获取该文档的所有 chunks
    const chunks = await db
      .select({ chunkIndex: knowledgeChunks.chunkIndex, content: knowledgeChunks.content })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.documentId, documentId))
      .orderBy(knowledgeChunks.chunkIndex);

    // 筛选相关 chunks
    const relevantChunks = chunks.filter((c) => isChunkRelevant(c.content, keywords));

    for (const chunk of relevantChunks) {
      if (allSources.length >= maxChunks) break;

      // 截取片段（用于展示）
      const snippet =
        chunk.content.length > 200
          ? chunk.content.substring(0, 200) + "..."
          : chunk.content;

      allSources.push({
        documentId,
        documentTitle: docTitleMap.get(documentId) ?? "Unknown",
        chunkIndex: chunk.chunkIndex,
        snippet,
      });
    }

    if (allSources.length >= maxChunks) break;
  }

  if (allSources.length === 0) {
    return null;
  }

  // 5. 构建 RAG 上下文（截断以符合 maxChunkChars）
  let context = allSources
    .map((s) => s.snippet)
    .join("\n\n---\n\n");

  // 如果上下文过长，截断
  if (context.length > maxChunkChars) {
    context = context.substring(0, maxChunkChars) + "\n...(truncated)";
  }

  return {
    context,
    documentIds,
    sources: allSources,
  };
}

/**
 * 为 Phase 2 规划检索 RAG 上下文
 *
 * EARS: REQ-015-AC-003 Phase 2 规划检索
 */
export async function getPlanningRAGContext(
  projectId: string,
  novelTitle?: string,
  theme?: string,
): Promise<string | null> {
  const db = getDb();

  // 获取绑定的所有文档
  const bindings = await db
    .select({ documentId: projectKnowledgeBindings.documentId })
    .from(projectKnowledgeBindings)
    .where(eq(projectKnowledgeBindings.projectId, projectId));

  if (bindings.length === 0) {
    return null;
  }

  const documentIds = bindings.map((b) => b.documentId);

  // 获取所有 chunks（最多 10 个）
  const chunks = await db
    .select({ content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .where(inArray(knowledgeChunks.documentId, documentIds))
    .orderBy(knowledgeChunks.chunkIndex)
    .limit(10);

  if (chunks.length === 0) {
    return null;
  }

  // 简单拼接（规划阶段可以接受较多上下文）
  const context = chunks.map((c) => c.content).join("\n\n");

  return context.length > 3000 ? context.substring(0, 3000) + "\n...(truncated)" : context;
}

/**
 * 检查新增参考是否会影响未开始的章节
 *
 * EARS: REQ-015-AC-004 创作中新增参考仅影响尚未开始的章节
 *
 * 返回：受影响的最早章节号（没有则返回 null）
 */
export async function getAffectedChapters(
  projectId: string,
  fromChapterNumber: number,
): Promise<number[]> {
  const db = getDb();

  const chapters = await db
    .select({ chapterNumber: contentFiles.chapterNumber })
    .from(contentFiles)
    .where(and(eq(contentFiles.projectId, projectId), gte(contentFiles.chapterNumber, fromChapterNumber)))
    .orderBy(contentFiles.chapterNumber);

  return chapters.map((c) => c.chapterNumber).filter((n): n is number => n !== null);
}

/**
 * 检查文档绑定是否与创作配置存在冲突
 *
 * EARS: REQ-015-AC-005 规划确认页展示警告
 *
 * 冲突检测规则：
 * 1. 绑定文档的字数/风格与小说设定不匹配（如：绑定武侠文档但设定的修仙小说）
 * 2. 绑定文档与小说类型明显不符
 *
 * 这里做简单的关键词冲突检测
 */
export async function checkDocumentConflicts(
  documentId: string,
  novelGenre?: string,
): Promise<{ hasConflict: boolean; warning?: string }> {
  const db = getDb();

  const [doc] = await db
    .select({ title: knowledgeDocuments.title })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId))
    .limit(1);

  if (!doc) {
    return { hasConflict: false };
  }

  // 简单冲突检测：标题中包含与小说类型冲突的关键词
  // 这个应该在 UI 层更精细地实现，这里只是基础版本
  const titleLower = doc.title.toLowerCase();

  // 预留扩展点：未来可以接入类型检测模型
  // 目前返回无冲突
  return { hasConflict: false };
}

/**
 * 格式化 RAG 来源信息（用于 UI 展示）
 *
 * EARS: REQ-015-AC-006 标明引用了哪些参考文档及片段
 */
export function formatRAGSources(
  sources: RAGContextResult["sources"],
): string {
  if (sources.length === 0) return "";

  const lines: string[] = ["【参考来源】"];

  for (const source of sources) {
    lines.push(
      `- 《${source.documentTitle}》 第${source.chunkIndex + 1}段：${source.snippet}`,
    );
  }

  return lines.join("\n");
}