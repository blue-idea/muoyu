/**
 * Knowledge Service
 *
 * 用户知识库管理：文档上传、URL 抓取、文本解析、入库
 * EARS: REQ-015-AC-001~005
 */

import { getDb } from "@/lib/db";
import {
  knowledgeDocuments,
  knowledgeChunks,
  projectKnowledgeBindings,
} from "@/drizzle/schema/knowledge";
import { createStorageDriver } from "@/lib/storage";
import { eq, and } from "drizzle-orm";
import type { KnowledgeDocStatus, KnowledgeSourceType } from "@/drizzle/schema/enums";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDocumentInput {
  userId: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceMeta?: Record<string, string>;
}

export interface DocumentResult {
  success: true;
  documentId: string;
  status: KnowledgeDocStatus;
}

export interface DocumentError {
  success: false;
  error: { code: string; message: string };
}

export interface ParsedContent {
  text: string;
  chunkCount: number;
}

// ---------------------------------------------------------------------------
// Text Extraction
// ---------------------------------------------------------------------------

/**
 * 从 ArrayBuffer 提取纯文本（支持 txt / md）
 */
function extractTextFromBuffer(buffer: Buffer, fileType: string): string {
  switch (fileType) {
    case "txt":
    case "md":
    case "markdown":
      return buffer.toString("utf8");

    default:
      return buffer.toString("utf8");
  }
}

/**
 * 从 .docx 提取文本（使用 mammoth）
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * 从 .pdf 提取文本（使用 pdf-parse）
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

/**
 * 从 .epub 提取文本（使用 mammoth）
 */
async function extractTextFromEpub(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * 解析上传文件内容
 */
export async function parseDocumentContent(
  buffer: Buffer,
  fileType: string,
): Promise<{ text: string } | { error: string }> {
  try {
    let text: string;

    switch (fileType.toLowerCase()) {
      case "docx":
      case "doc":
        text = await extractTextFromDocx(buffer);
        break;

      case "pdf":
        text = await extractTextFromPdf(buffer);
        break;

      case "epub":
        text = await extractTextFromEpub(buffer);
        break;

      case "txt":
      case "md":
      case "markdown":
        text = extractTextFromBuffer(buffer, fileType);
        break;

      default:
        return { error: `Unsupported file type: ${fileType}` };
    }

    // 清理空白字符
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "  ");
    // 折叠连续空行
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      return { error: "Document is empty after parsing." };
    }

    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse document.";
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Text Chunking
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 500; // 每块字符数
const CHUNK_OVERLAP = 50; // 重叠字符数

/**
 * 将长文本分块
 */
function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (text.length <= chunkSize) {
    return text ? [text] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;

    if (start > 0) {
      // 重叠前一块末尾
      const overlapStart = Math.max(0, start - overlap);
      const overlapText = text.substring(overlapStart, start);
      chunks.push(overlapText + text.substring(start, end));
    } else {
      chunks.push(text.substring(start, end));
    }

    start += chunkSize;
  }

  return chunks.filter((c) => c.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Document Management
// ---------------------------------------------------------------------------

/**
 * 创建知识库文档记录
 */
export async function createKnowledgeDocument(
  input: CreateDocumentInput,
): Promise<DocumentResult | DocumentError> {
  const db = getDb();

  const storage = createStorageDriver();

  // 生成存储 key
  const documentId = crypto.randomUUID();
  const storageKey = `knowledge/${input.userId}/${documentId}/text`;

  try {
    const [record] = await db
      .insert(knowledgeDocuments)
      .values({
        userId: input.userId,
        title: input.title,
        sourceType: input.sourceType,
        sourceMeta: input.sourceMeta ?? {},
        status: "processing",
        textStorageKey: storageKey,
      })
      .returning();

    return {
      success: true,
      documentId: record.id,
      status: record.status as KnowledgeDocStatus,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create document.";
    return { success: false, error: { code: "DB_ERROR", message } };
  }
}

/**
 * 解析并存储文档内容
 */
export async function processDocument(
  documentId: string,
  content: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const db = getDb();
  const storage = createStorageDriver();

  // 获取文档记录
  const [doc] = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId))
    .limit(1);

  if (!doc) {
    return { success: false, error: "Document not found." };
  }

  // 分块
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    await db
      .update(knowledgeDocuments)
      .set({ status: "failed", failureReason: "No content to store." })
      .where(eq(knowledgeDocuments.id, documentId));
    return { success: false, error: "No content to store." };
  }

  // 写入存储
  try {
    await storage.writeText(doc.textStorageKey, content);
  } catch {
    return { success: false, error: "Failed to write content to storage." };
  }

  // 删除旧 chunks
  await db
    .delete(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, documentId));

  // 写入新 chunks
  for (let i = 0; i < chunks.length; i++) {
    await db.insert(knowledgeChunks).values({
      documentId,
      chunkIndex: i,
      content: chunks[i],
      embedding: null, // 向量嵌入暂不实现
    });
  }

  // 更新文档状态
  await db
    .update(knowledgeDocuments)
    .set({ status: "ready" })
    .where(eq(knowledgeDocuments.id, documentId));

  return { success: true };
}

/**
 * 上传并解析文档文件
 */
export async function uploadDocument(
  userId: string,
  title: string,
  fileBuffer: Buffer,
  fileType: string,
): Promise<DocumentResult | DocumentError> {
  // 解析内容
  const parsed = await parseDocumentContent(fileBuffer, fileType);

  if ("error" in parsed) {
    return { success: false, error: { code: "PARSE_ERROR", message: parsed.error } };
  }

  // 创建文档记录
  const createResult = await createKnowledgeDocument({
    userId,
    title,
    sourceType: "upload",
    sourceMeta: { fileType },
  });

  if (!createResult.success) {
    return createResult;
  }

  // 处理内容
  const processResult = await processDocument(createResult.documentId, parsed.text);

  if (!processResult.success) {
    // 更新文档状态为失败
    const db = getDb();
    await db
      .update(knowledgeDocuments)
      .set({ status: "failed", failureReason: processResult.error })
      .where(eq(knowledgeDocuments.id, createResult.documentId));

    return { success: false, error: { code: "PROCESS_ERROR", message: processResult.error } };
  }

  return {
    success: true,
    documentId: createResult.documentId,
    status: "ready",
  };
}

/**
 * 抓取 URL 内容
 */
export async function fetchUrlContent(
  url: string,
): Promise<{ title: string; text: string } | { error: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MuoyuBot/1.0; +https://muoyu.example.com/bot)",
      },
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();

    // 使用 cheerio 解析 HTML
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);

    // 提取标题
    const title =
      $("h1").first().text().trim() ||
      $("title").first().text().trim() ||
      new URL(url).hostname;

    // 移除脚本和样式
    $("script, style, nav, footer, header, aside").remove();

    // 提取正文
    const text = $.text().replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\t/g, "  ").replace(/\n{3,}/g, "\n\n").trim();

    if (!text) {
      return { error: "No content found on page." };
    }

    return { title, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch URL.";
    return { error: message };
  }
}

/**
 * 添加 URL 来源的文档
 */
export async function addUrlDocument(
  userId: string,
  url: string,
): Promise<DocumentResult | DocumentError> {
  // 抓取内容
  const content = await fetchUrlContent(url);

  if ("error" in content) {
    return { success: false, error: { code: "FETCH_ERROR", message: content.error } };
  }

  // 创建文档记录
  const createResult = await createKnowledgeDocument({
    userId,
    title: content.title,
    sourceType: "url",
    sourceMeta: { url },
  });

  if (!createResult.success) {
    return createResult;
  }

  // 处理内容
  const processResult = await processDocument(createResult.documentId, content.text);

  if (!processResult.success) {
    const db = getDb();
    await db
      .update(knowledgeDocuments)
      .set({ status: "failed", failureReason: processResult.error })
      .where(eq(knowledgeDocuments.id, createResult.documentId));

    return { success: false, error: { code: "PROCESS_ERROR", message: processResult.error } };
  }

  return {
    success: true,
    documentId: createResult.documentId,
    status: "ready",
  };
}

/**
 * 获取用户的知识库文档列表
 */
export async function listKnowledgeDocuments(
  userId: string,
): Promise<{
  success: true;
  documents: Array<{
    id: string;
    title: string;
    sourceType: KnowledgeSourceType;
    status: KnowledgeDocStatus;
    failureReason: string | null;
    createdAt: Date;
  }>;
} | DocumentError> {
  const db = getDb();

  const docs = await db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      sourceType: knowledgeDocuments.sourceType,
      status: knowledgeDocuments.status,
      failureReason: knowledgeDocuments.failureReason,
      createdAt: knowledgeDocuments.createdAt,
    })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.userId, userId))
    .orderBy(knowledgeDocuments.createdAt);

  return {
    success: true,
    documents: docs.map((d) => ({
      ...d,
      status: d.status as KnowledgeDocStatus,
    })),
  };
}

/**
 * 删除知识库文档
 */
export async function deleteKnowledgeDocument(
  documentId: string,
  userId: string,
): Promise<{ success: true } | DocumentError> {
  const db = getDb();

  const [doc] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, documentId), eq(knowledgeDocuments.userId, userId)))
    .limit(1);

  if (!doc) {
    return { success: false, error: { code: "NOT_FOUND", message: "Document not found." } };
  }

  // 删除 chunks 和文档
  await db.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));
  await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId));

  // 删除存储内容
  try {
    const storage = createStorageDriver();
    await storage.deletePrefix(doc.textStorageKey);
  } catch {
    // 忽略存储删除失败
  }

  return { success: true };
}

/**
 * 将文档绑定到作品
 */
export async function bindDocumentToProject(
  documentId: string,
  projectId: string,
): Promise<{ success: true } | DocumentError> {
  const db = getDb();

  try {
    await db.insert(projectKnowledgeBindings).values({
      projectId,
      documentId,
    });

    return { success: true };
  } catch {
    // 忽略重复绑定错误
    return { success: true };
  }
}

/**
 * 获取作品的绑定文档
 */
export async function getProjectBindings(
  projectId: string,
): Promise<
  | {
      success: true;
      documents: Array<{
        id: string;
        title: string;
        sourceType: KnowledgeSourceType;
        status: KnowledgeDocStatus;
        boundAt: Date;
      }>;
    }
  | DocumentError
> {
  const db = getDb();

  const bindings = await db
    .select({
      id: knowledgeDocuments.id,
      title: knowledgeDocuments.title,
      sourceType: knowledgeDocuments.sourceType,
      status: knowledgeDocuments.status,
      boundAt: projectKnowledgeBindings.boundAt,
    })
    .from(projectKnowledgeBindings)
    .innerJoin(
      knowledgeDocuments,
      eq(knowledgeDocuments.id, projectKnowledgeBindings.documentId),
    )
    .where(eq(projectKnowledgeBindings.projectId, projectId));

  return {
    success: true,
    documents: bindings.map((b) => ({
      ...b,
      status: b.status as KnowledgeDocStatus,
    })),
  };
}

/**
 * 搜索文档内容（简单关键词匹配）
 */
export async function searchDocumentContent(
  documentId: string,
  query: string,
  limit = 5,
): Promise<{ success: true; chunks: Array<{ content: string; chunkIndex: number }> } | DocumentError> {
  const db = getDb();

  // 简单实现：按关键词在 chunks 中搜索
  // 正式实现应使用向量嵌入相似度搜索
  const chunks = await db
    .select({
      chunkIndex: knowledgeChunks.chunkIndex,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, documentId))
    .orderBy(knowledgeChunks.chunkIndex)
    .limit(50); // 限制搜索范围

  const queryLower = query.toLowerCase();
  const matched = chunks
    .filter((c) => c.content.toLowerCase().includes(queryLower))
    .slice(0, limit);

  return {
    success: true,
    chunks: matched.map((c) => ({
      content: c.content,
      chunkIndex: c.chunkIndex,
    })),
  };
}