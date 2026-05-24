/**
 * Regenerate Service
 *
 * 章节大纲/正文重生
 * EARS: REQ-016-AC-001~005
 */

import { getDb } from "@/lib/db";
import { getLLMClientForUser } from "@/lib/ai/llm-router";
import { contentFiles } from "@/drizzle/schema/content-files";
import { generationJobs } from "@/drizzle/schema/jobs";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OutlineRow {
  chapterNumber: number;
  title: string;
  coreEvent?: string;
  scene: string;
  plot: string;
  characters: string;
  setting: string;
  theme: string;
}

export interface DiffLine {
  field: string;
  oldValue: string;
  newValue: string;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function buildChapterStorageKey(projectId: string, chapterNumber: number, title: string): string {
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 50);
  return `projects/${projectId}/chapters/${String(chapterNumber).padStart(2, "0")}章-${safeTitle}.md`;
}

function parseOutlineFromMarkdown(markdown: string): OutlineRow[] {
  // 简单解析：从 Markdown 表格提取章节行
  // 格式：| 章节号 | 标题 | 场景 | ... |
  const rows: OutlineRow[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (line.startsWith("|") && line.includes("第") && line.includes("章")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 7) {
        const chapterMatch = cells[0].match(/第(\d+)章/);
        if (chapterMatch) {
          rows.push({
            chapterNumber: parseInt(chapterMatch[1], 10),
            title: cells[1] ?? "",
            scene: cells[2] ?? "",
            coreEvent: cells[3] ?? "",
            plot: cells[4] ?? "",
            characters: cells[5] ?? "",
            setting: cells[6] ?? "",
            theme: cells[7] ?? "",
          });
        }
      }
    }
  }

  return rows;
}

function outlineToMarkdownRow(row: OutlineRow): string {
  return `| 第${row.chapterNumber}章 | ${row.title} | ${row.scene} | ${row.coreEvent ?? ""} | ${row.plot} | ${row.characters} | ${row.setting} | ${row.theme} |`;
}

// ---------------------------------------------------------------------------
// Outline Regeneration
// ---------------------------------------------------------------------------

/**
 * 生成新的章节大纲行（7列）
 *
 * EARS: REQ-016-AC-001 基于上下文生成新的大纲行，并在替换前展示 diff
 */
export async function regenerateChapterOutline(
  projectId: string,
  userId: string,
  chapterNumber: number,
  userInstruction?: string,
): Promise<
  | { success: true; oldOutline: OutlineRow; newOutline: OutlineRow; diff: DiffLine[] }
  | { success: false; error: { code: string; message: string } }
> {
  const llm = await getLLMClientForUser(userId, projectId);

  // 读取 R2 上的大纲文件
  const { createStorageDriver } = await import("@/lib/storage");
  const storage = createStorageDriver();

  let outlineMarkdown: string;
  try {
    outlineMarkdown = await storage.readText(`projects/${projectId}/outline/01-大纲.md`);
  } catch {
    return { success: false, error: { code: "OUTLINE_NOT_FOUND", message: "Project outline not found in storage." } };
  }

  // 解析现有大纲
  const outline = parseOutlineFromMarkdown(outlineMarkdown);
  const currentRow = outline.find((r) => r.chapterNumber === chapterNumber);

  if (!currentRow) {
    return { success: false, error: { code: "CHAPTER_NOT_FOUND", message: "Chapter outline row not found." } };
  }

  // 构建重生 prompt
  const systemPrompt = `你是网络小说大纲专家。请根据以下信息为第${chapterNumber}章生成新的大纲行。保持与前后章节的连贯性。

【章节号】第${chapterNumber}章

【当前大纲行】
标题: ${currentRow.title}
场景: ${currentRow.scene}
核心事件: ${currentRow.coreEvent ?? "无"}
情节: ${currentRow.plot}
人物: ${currentRow.characters}
设定: ${currentRow.setting}
主题: ${currentRow.theme}

【用户指令】
${userInstruction ?? "请根据当前大纲行重新生成，保持连贯性。"}`;

  // 调用 LLM
  const response = await llm.chat({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请为第${chapterNumber}章生成新的大纲行。返回 JSON 格式：
{
  "title": "章节标题",
  "scene": "场景描述",
  "coreEvent": "核心事件",
  "plot": "情节",
  "characters": "出场人物",
  "setting": "设定",
  "theme": "主题"
}`,
      },
    ],
    temperature: 0.7,
  });

  // 解析 LLM 返回
  let newRowPartial: Partial<OutlineRow>;
  try {
    const parsed = JSON.parse(response.content);
    newRowPartial = {
      title: parsed.title ?? currentRow.title,
      scene: parsed.scene ?? currentRow.scene,
      coreEvent: parsed.coreEvent,
      plot: parsed.plot ?? currentRow.plot,
      characters: parsed.characters ?? currentRow.characters,
      setting: parsed.setting ?? currentRow.setting,
      theme: parsed.theme ?? currentRow.theme,
    };
  } catch {
    return { success: false, error: { code: "PARSE_ERROR", message: "Failed to parse LLM response." } };
  }

  const newRow: OutlineRow = {
    chapterNumber,
    title: newRowPartial.title ?? currentRow.title,
    scene: newRowPartial.scene ?? currentRow.scene,
    coreEvent: newRowPartial.coreEvent,
    plot: newRowPartial.plot ?? currentRow.plot,
    characters: newRowPartial.characters ?? currentRow.characters,
    setting: newRowPartial.setting ?? currentRow.setting,
    theme: newRowPartial.theme ?? currentRow.theme,
  };

  // 计算 diff
  const fields: (keyof OutlineRow)[] = ["title", "scene", "coreEvent", "plot", "characters", "setting", "theme"];
  const diff: DiffLine[] = fields
    .map((field) => ({
      field,
      oldValue: String(currentRow[field] ?? ""),
      newValue: String(newRow[field] ?? ""),
    }))
    .filter((d) => d.oldValue !== d.newValue);

  return { success: true, oldOutline: currentRow, newOutline: newRow, diff };
}

/**
 * 确认并应用新的大纲行
 */
export async function applyRegeneratedOutline(
  projectId: string,
  newOutline: OutlineRow,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  try {
    const { createStorageDriver } = await import("@/lib/storage");
    const storage = createStorageDriver();

    // 读取当前大纲
    const outlineMarkdown = await storage.readText(`projects/${projectId}/outline/01-大纲.md`);
    const lines = outlineMarkdown.split("\n");

    // 找到并替换对应章节行
    const newLines = lines.map((line) => {
      if (line.startsWith("|") && line.includes(`第${newOutline.chapterNumber}章`)) {
        return outlineToMarkdownRow(newOutline);
      }
      return line;
    });

    await storage.writeText(`projects/${projectId}/outline/01-大纲.md`, newLines.join("\n"));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update outline.";
    return { success: false, error: { code: "UPDATE_FAILED", message } };
  }
}

// ---------------------------------------------------------------------------
// Content Regeneration
// ---------------------------------------------------------------------------

/**
 * 重新生成章节正文
 *
 * EARS: REQ-016-AC-003 按 REQ-010 单章创作子流程
 */
export async function regenerateChapterContent(
  projectId: string,
  userId: string,
  chapterNumber: number,
  userInstruction?: string,
): Promise<
  | { success: true; oldWordCount: number | null; newWordCount: number; summary: string }
  | { success: false; error: { code: string; message: string } }
> {
  const db = getDb();
  const llm = await getLLMClientForUser(userId, projectId);

  // 读取大纲
  const { createStorageDriver } = await import("@/lib/storage");
  const storage = createStorageDriver();

  let outlineMarkdown: string;
  try {
    outlineMarkdown = await storage.readText(`projects/${projectId}/outline/01-大纲.md`);
  } catch {
    return { success: false, error: { code: "OUTLINE_NOT_FOUND", message: "Outline not found." } };
  }

  const outline = parseOutlineFromMarkdown(outlineMarkdown);
  const currentRow = outline.find((r) => r.chapterNumber === chapterNumber);

  if (!currentRow) {
    return { success: false, error: { code: "CHAPTER_NOT_FOUND", message: "Chapter outline row not found." } };
  }

  // 获取旧的正文字数
  const [existingFile] = await db
    .select({ wordCount: contentFiles.wordCount })
    .from(contentFiles)
    .where(and(eq(contentFiles.projectId, projectId), eq(contentFiles.chapterNumber, chapterNumber)))
    .limit(1);

  const oldWordCount = existingFile?.wordCount ?? null;

  // 构建创作 prompt（简化版，不依赖 phase2-planning）
  const systemPrompt = `你是网络小说作者，请根据以下大纲写第${chapterNumber}章。

【章节标题】${currentRow.title}
【场景】${currentRow.scene}
【核心事件】${currentRow.coreEvent ?? "无"}
【情节】${currentRow.plot}
【人物】${currentRow.characters}
【设定】${currentRow.setting}
【主题】${currentRow.theme}

${userInstruction ? `【用户指令】${userInstruction}` : ""}

要求：3000-5000 字，情节连贯，符合人物设定。`;

  // 调用 LLM 生成
  const response = await llm.chat({
    messages: [{ role: "user", content: systemPrompt }],
    temperature: 0.7,
  });

  const content = response.content.trim();
  const newWordCount = content.length;
  const summary = content.length > 300 ? content.substring(0, 300) + "..." : content;

  // 写入存储
  const storageKey = buildChapterStorageKey(projectId, chapterNumber, currentRow.title);
  await storage.writeText(storageKey, content);

  // 更新数据库
  await db
    .update(contentFiles)
    .set({ wordCount: newWordCount, updatedAt: new Date() })
    .where(and(eq(contentFiles.projectId, projectId), eq(contentFiles.chapterNumber, chapterNumber)));

  return { success: true, oldWordCount, newWordCount, summary };
}

// ---------------------------------------------------------------------------
// Queue Management
// ---------------------------------------------------------------------------

/**
 * 暂停创作队列
 *
 * EARS: REQ-016-AC-005 串行创作进行中时，重生第 K 章需暂停队列
 */
export async function pauseWritingJob(projectId: string): Promise<{ success: true }> {
  const db = getDb();

  await db
    .update(generationJobs)
    .set({ status: "cancelled" })
    .where(and(eq(generationJobs.projectId, projectId), eq(generationJobs.status, "running")));

  return { success: true };
}

/**
 * 恢复创作队列
 *
 * EARS: REQ-016-AC-005 完成第 K 章重生后，从第 K 或 K+1 章继续
 */
export async function resumeWritingJob(projectId: string, fromChapter: number): Promise<{ success: true }> {
  const db = getDb();

  await db
    .update(generationJobs)
    .set({
      status: "pending",
      currentChapterNumber: fromChapter,
    })
    .where(and(eq(generationJobs.projectId, projectId), eq(generationJobs.status, "cancelled")));

  return { success: true };
}