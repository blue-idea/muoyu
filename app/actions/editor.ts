"use server";

/**
 * Editor Server Actions
 *
 * 一致性检查与 AI 润色
 * EARS: REQ-013-AC-002~004
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import {
  saveChapter,
  runConsistencyCheck,
  polishChapter,
  type ConsistencyIssue,
} from "@/lib/editor/editor-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveChapterInput {
  projectId: string;
  chapterNumber: number;
  content: string;
  confirmWordCountWarning?: boolean;
}

export interface SaveChapterResult {
  success: true;
  wordCount: number;
  wordCountPass: boolean;
  warning?: string | null;
}

export interface EditorError {
  success: false;
  error: { code: string; message: string };
}

export interface ConsistencyCheckInput {
  projectId: string;
  scope: "book" | "chapter";
  chapterNumber?: number;
}

export interface ConsistencyCheckResult {
  success: true;
  issues: ConsistencyIssue[];
}

export interface PolishInput {
  projectId: string;
  chapterNumber: number;
  selection?: { start: number; end: number };
}

export interface PolishResult {
  success: true;
  diff: string;
  polishedContent: string;
}

export interface AcceptPolishInput {
  projectId: string;
  chapterNumber: number;
  content: string;
  confirmWordCountWarning?: boolean;
}

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

const ERROR_CODES = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  STORAGE_IO_ERROR: "STORAGE_IO_ERROR",
  LLM_CONFIG_ERROR: "LLM_CONFIG_ERROR",
  WRITING_PLAN_CORRUPTED: "WRITING_PLAN_CORRUPTED",
} as const;

// ---------------------------------------------------------------------------
// saveChapter
// ---------------------------------------------------------------------------

export async function editorSaveChapter(
  input: SaveChapterInput,
): Promise<SaveChapterResult | EditorError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const result = await saveChapter({
    projectId: input.projectId,
    userId,
    chapterNumber: input.chapterNumber,
    content: input.content,
    confirmWordCountWarning: input.confirmWordCountWarning,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    wordCount: result.wordCount,
    wordCountPass: result.wordCountPass,
    warning: result.warning,
  };
}

// ---------------------------------------------------------------------------
// runConsistencyCheck
// ---------------------------------------------------------------------------

export async function editorRunConsistencyCheck(
  input: ConsistencyCheckInput,
): Promise<ConsistencyCheckResult | EditorError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 归属校验
  try {
    await getProjectForUser(input.projectId, userId);
  } catch {
    return {
      success: false,
      error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: "Project not found." },
    };
  }

  const result = await runConsistencyCheck({
    projectId: input.projectId,
    userId,
    scope: input.scope,
    chapterNumber: input.chapterNumber,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    issues: result.issues,
  };
}

// ---------------------------------------------------------------------------
// polishChapter
// ---------------------------------------------------------------------------

export async function editorPolishChapter(
  input: PolishInput,
): Promise<PolishResult | EditorError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 归属校验
  try {
    await getProjectForUser(input.projectId, userId);
  } catch {
    return {
      success: false,
      error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: "Project not found." },
    };
  }

  const result = await polishChapter({
    projectId: input.projectId,
    userId,
    chapterNumber: input.chapterNumber,
    selection: input.selection,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    diff: result.diff,
    polishedContent: result.polishedContent,
  };
}

// ---------------------------------------------------------------------------
// acceptPolish
// ---------------------------------------------------------------------------

export async function editorAcceptPolish(
  input: AcceptPolishInput,
): Promise<SaveChapterResult | EditorError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const result = await saveChapter({
    projectId: input.projectId,
    userId,
    chapterNumber: input.chapterNumber,
    content: input.content,
    confirmWordCountWarning: input.confirmWordCountWarning,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    wordCount: result.wordCount,
    wordCountPass: result.wordCountPass,
    warning: result.warning,
  };
}