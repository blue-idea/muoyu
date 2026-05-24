/**
 * Export Service
 *
 * 四格式导出管道：MD / TXT / PDF / EPUB
 * EARS: REQ-012-AC-003, AC-004
 */

import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { exportRecords } from "@/drizzle/schema/exports";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import type { ExportFormat } from "@/drizzle/schema/enums";
import type { JsonObject } from "@/drizzle/schema/json";
import type { StorageDriver } from "@/lib/storage/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportMetadata {
  title: string;
  author?: string;
  description?: string;
}

export interface CreateExportInput {
  projectId: string;
  userId: string;
  format: ExportFormat;
  metadata: ExportMetadata;
}

export interface CreateExportOutput {
  success: true;
  exportId: string;
  downloadUrl: string;
  fileSize?: number;
}

export interface ExportError {
  success: false;
  error: { code: string; message: string };
}

export interface ListExportsInput {
  projectId: string;
  userId: string;
}

export interface ExportRecord {
  id: string;
  format: ExportFormat;
  metadata: ExportMetadata;
  storageKey: string;
  fileSize?: number | null;
  createdAt: Date;
}

export interface ListExportsOutput {
  success: true;
  exports: ExportRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_FILE_NAME = "00-人物档案.md";
const OUTLINE_FILE_NAME = "01-大纲.md";
const PLANNING_FILE_NAME = "02-写作计划.json";

const EXPORT_PATH_PREFIX = "exports/";

// ---------------------------------------------------------------------------
// 创建导出任务
// ---------------------------------------------------------------------------

/**
 * 创建导出文件（MD/TXT/PDF/EPUB）
 *
 * EARS: REQ-012-AC-003
 * - 从 R2 读取所有章节内容
 * - 组装并生成目标格式
 * - 写入 R2 export path
 * - 记录 export_records
 */
export async function createExport(
  input: CreateExportInput,
): Promise<CreateExportOutput | ExportError> {
  const { projectId, userId, format, metadata } = input;

  const db = getDb();
  const storage = createStorageDriver();

  // 查询项目
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } };
  }

  if (project.userId !== userId) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } };
  }

  // 读取写作计划获取章节目录
  let writingPlan: {
    chapters: Array<{ chapterNumber: number; title: string; status: string }>;
  };

  try {
    const planContent = await storage.readText(`${project.storagePrefix}${PLANNING_FILE_NAME}`);
    writingPlan = JSON.parse(planContent);
  } catch {
    return { success: false, error: { code: "WRITING_PLAN_CORRUPTED", message: "Writing plan JSON is corrupted." } };
  }

  // 按顺序排列章节（只取 completed）
  const chapters = writingPlan.chapters
    .filter((c) => c.status === "completed")
    .sort((a, b) => a.chapterNumber - b.chapterNumber);

  if (chapters.length === 0) {
    return { success: false, error: { code: "EXPORT_FAILED", message: "No completed chapters to export." } };
  }

  // 读取各章内容
  const chapterContents: Array<{ number: number; title: string; content: string }> = [];

  for (const chapter of chapters) {
    const fileName = `第${String(chapter.chapterNumber).padStart(2, "0")}章-${chapter.title}.md`;
    const r2Key = `${project.storagePrefix}${fileName}`;

    try {
      const content = await storage.readText(r2Key);
      chapterContents.push({
        number: chapter.chapterNumber,
        title: chapter.title,
        content,
      });
    } catch {
      // 单章读取失败不影响整体
    }
  }

  if (chapterContents.length === 0) {
    return { success: false, error: { code: "EXPORT_FAILED", message: "Failed to read any chapter content." } };
  }

  // 读取人物档案和大纲（可选）
  let frontMatter = "";
  try {
    const profile = await storage.readText(`${project.storagePrefix}${PROFILE_FILE_NAME}`);
    frontMatter += `\n\n# 人物档案\n\n${profile}`;
  } catch {
    // 忽略
  }

  try {
    const outline = await storage.readText(`${project.storagePrefix}${OUTLINE_FILE_NAME}`);
    frontMatter += `\n\n# 大纲\n\n${outline}`;
  } catch {
    // 忽略
  }

  // 生成导出内容
  let exportContent: string;
  let fileExtension: string;
  let contentType: string;

  switch (format) {
    case "md":
      exportContent = buildMarkdownExport(metadata, frontMatter, chapterContents);
      fileExtension = "md";
      contentType = "text/markdown; charset=utf-8";
      break;

    case "txt":
      exportContent = buildTextExport(metadata, frontMatter, chapterContents);
      fileExtension = "txt";
      contentType = "text/plain; charset=utf-8";
      break;

    case "pdf":
      exportContent = buildHtmlForPdf(metadata, frontMatter, chapterContents);
      fileExtension = "html"; // PDF 用 HTML 做中间格式，由 API 路由转换为 PDF
      contentType = "text/html; charset=utf-8";
      break;

    case "epub":
      exportContent = buildEpubXml(metadata, frontMatter, chapterContents);
      fileExtension = "epub";
      contentType = "application/epub+zip";
      break;

    default:
      return { success: false, error: { code: "EXPORT_FAILED", message: `Unsupported format: ${format}` } };
  }

  // 生成存储路径
  const timestamp = Date.now();
  const safeTitle = metadata.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_").slice(0, 50);
  const storageKey = `${EXPORT_PATH_PREFIX}${userId}/${projectId}/${safeTitle}_${timestamp}.${fileExtension}`;

  // 写入 R2
  if (format === "pdf" || format === "epub") {
    const bytes = new TextEncoder().encode(exportContent);
    await storage.writeBytes(storageKey, bytes, contentType);
  } else {
    await storage.writeText(storageKey, exportContent);
  }

  // 记录导出历史
  const fileSize = exportContent.length;

  const [record] = await db
    .insert(exportRecords)
    .values({
      projectId,
      userId,
      format,
      metadata: metadata as unknown as JsonObject,
      storageKey,
      fileSize,
    })
    .returning();

  return {
    success: true,
    exportId: record.id,
    downloadUrl: `/api/projects/${projectId}/exports/${record.id}/download`,
    fileSize,
  };
}

// ---------------------------------------------------------------------------
// 列出导出历史
// ---------------------------------------------------------------------------

/**
 * 列出项目的导出记录
 */
export async function listExports(
  input: ListExportsInput,
): Promise<ListExportsOutput | ExportError> {
  const { projectId, userId } = input;

  const db = getDb();

  const records = await db
    .select()
    .from(exportRecords)
    .where(eq(exportRecords.projectId, projectId))
    .orderBy(exportRecords.createdAt);

  return {
    success: true,
    exports: records.map((r) => ({
      id: r.id,
      format: r.format,
      metadata: r.metadata as unknown as ExportMetadata,
      storageKey: r.storageKey,
      fileSize: r.fileSize,
      createdAt: r.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// 下载导出文件（读取 R2 对象）
// ---------------------------------------------------------------------------

/**
 * 读取导出的文件内容
 */
export async function getExportContent(
  projectId: string,
  exportId: string,
  _userId: string,
): Promise<{ success: true; content: string; contentType: string } | ExportError> {
  const db = getDb();
  const storage = createStorageDriver();

  const [record] = await db
    .select()
    .from(exportRecords)
    .where(eq(exportRecords.id, exportId))
    .limit(1);

  if (!record) {
    return { success: false, error: { code: "EXPORT_FAILED", message: "Export record not found." } };
  }

  if (record.projectId !== projectId) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } };
  }

  try {
    let content: string;
    let contentType: string;

    if (record.format === "md" || record.format === "txt") {
      content = await storage.readText(record.storageKey);
      contentType = record.format === "md"
        ? "text/markdown; charset=utf-8"
        : "text/plain; charset=utf-8";
    } else {
      // PDF/EPUB 返回 Base64
      const bytes = await storage.readBytes(record.storageKey);
      content = Buffer.from(bytes).toString("base64");
      contentType = record.format === "pdf"
        ? "application/pdf"
        : "application/epub+zip";
    }

    return { success: true, content, contentType };
  } catch {
    return { success: false, error: { code: "EXPORT_FAILED", message: "Failed to read export file." } };
  }
}

// ---------------------------------------------------------------------------
// 构建导出内容
// ---------------------------------------------------------------------------

/**
 * 构建 Markdown 格式导出
 */
function buildMarkdownExport(
  metadata: ExportMetadata,
  frontMatter: string,
  chapters: Array<{ number: number; title: string; content: string }>,
): string {
  const lines: string[] = [];

  lines.push(`# ${metadata.title}`);
  if (metadata.author) lines.push(`\n**作者**：${metadata.author}`);
  if (metadata.description) lines.push(`\n${metadata.description}`);
  lines.push(frontMatter);

  lines.push("\n\n---\n\n# 正文\n");

  for (const chapter of chapters) {
    lines.push(`\n\n## 第${chapter.number}章：${chapter.title}\n\n`);
    lines.push(chapter.content);
  }

  return lines.join("");
}

/**
 * 构建纯文本格式导出（去除 Markdown 语法）
 */
function buildTextExport(
  metadata: ExportMetadata,
  frontMatter: string,
  chapters: Array<{ number: number; title: string; content: string }>,
): string {
  const lines: string[] = [];

  lines.push(metadata.title);
  lines.push("=".repeat(metadata.title.length));
  if (metadata.author) lines.push(`\n作者：${metadata.author}`);
  if (metadata.description) lines.push(`\n${metadata.description}`);
  lines.push("\n");

  // 去除 frontMatter 中的 Markdown 标题符号
  const cleanFront = frontMatter
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  lines.push(cleanFront);

  lines.push("\n\n====================\n\n# 正文\n\n");

  for (const chapter of chapters) {
    lines.push(`\n第${chapter.number}章：${chapter.title}\n`);
    lines.push("-".repeat(20));
    lines.push("\n");
    lines.push(stripMarkdown(chapter.content));
    lines.push("\n\n");
  }

  return lines.join("");
}

/**
 * 构建 PDF 用的 HTML（中间格式，由 API 路由通过 Playwright 转换为 PDF）
 */
function buildHtmlForPdf(
  metadata: ExportMetadata,
  _frontMatter: string,
  chapters: Array<{ number: number; title: string; content: string }>,
): string {
  const chapterHtmls = chapters.map((ch) => {
    const body = ch.content
      .split("\n\n")
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("\n");

    return `
      <div class="chapter">
        <h2>第${ch.number}章：${escapeHtml(ch.title)}</h2>
        <div class="chapter-body">${body}</div>
      </div>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(metadata.title)}</title>
  <style>
    body { font-family: "Songti SC", "SimSun", serif; font-size: 16px; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { text-align: center; font-size: 28px; margin-bottom: 10px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 40px; }
    .chapter { margin-bottom: 40px; page-break-after: always; }
    .chapter h2 { font-size: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
    .chapter-body p { text-indent: 2em; margin-bottom: 1em; }
    .chapter-body { text-align: justify; }
  </style>
</head>
<body>
  <h1>${escapeHtml(metadata.title)}</h1>
  ${metadata.author ? `<div class="subtitle">作者：${escapeHtml(metadata.author)}</div>` : ""}
  ${chapterHtmls}
</body>
</html>`;
}

/**
 * 构建 EPUB XML（简化的 EPUB 结构）
 * 实际 EPUB 为 ZIP 压缩包，此处输出 XML 字符串，由 API 路由包装为 EPUB
 */
function buildEpubXml(
  metadata: ExportMetadata,
  _frontMatter: string,
  chapters: Array<{ number: number; title: string; content: string }>,
): string {
  // EPUB 结构为 XML 格式，实际部署需要 zip 打包
  // 此处返回简化 XML，API 路由处理时做 EPUB 打包
  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>
<book xmlns="http://www.muoyu.app/epub">
  <metadata>
    <title>${escapeHtml(metadata.title)}</title>
    ${metadata.author ? `<author>${escapeHtml(metadata.author)}</author>` : ""}
    ${metadata.description ? `<description>${escapeHtml(metadata.description)}</description>` : ""}
  </metadata>
  <chapters>`);

  for (const ch of chapters) {
    const body = escapeHtml(ch.content);
    lines.push(`    <chapter number="${ch.number}" title="${escapeHtml(ch.title)}">
      <content><![CDATA[${ch.content}]]></content>
    </chapter>`);
  }

  lines.push("  </chapters>\n</book>");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 去除 Markdown 语法（用于纯文本导出）
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, "") // 标题
    .replace(/\*\*(.*?)\*\*/g, "$1") // 粗体
    .replace(/\*(.*?)\*/g, "$1") // 斜体
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // 图片
    .replace(/^[-*+]\s+/gm, "- ") // 无序列表
    .replace(/^\d+\.\s+/gm, "0. ") // 有序列表
    .replace(/^>\s+/gm, "") // 引用
    .replace(/^---+$/gm, "") // 分隔线
    .trim();
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}