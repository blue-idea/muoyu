"use server";

/**
 * Regenerate Server Actions
 *
 * 章节大纲/正文重生 API
 * EARS: REQ-016-AC-001~005
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  regenerateChapterOutline,
  applyRegeneratedOutline,
  regenerateChapterContent,
  pauseWritingJob,
  resumeWritingJob,
} from "@/lib/regenerate/regenerate-service";
import type { OutlineRow } from "@/lib/regenerate/regenerate-service";

export async function regenerateOutline(
  projectId: string,
  chapterNumber: number,
  userInstruction?: string,
): Promise<
  | {
      success: true;
      oldOutline: OutlineRow;
      newOutline: OutlineRow;
      diff: Array<{ field: string; oldValue: string; newValue: string }>;
    }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return regenerateChapterOutline(projectId, userId, chapterNumber, userInstruction);
}

export async function applyOutline(
  projectId: string,
  newOutline: OutlineRow,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const { getProjectForUser } = await import("@/lib/db/get-project-for-user");
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    return { success: false, error: { code: "ACCESS_DENIED", message: "Project not found." } };
  }

  return applyRegeneratedOutline(projectId, newOutline);
}

export async function regenerateContent(
  projectId: string,
  chapterNumber: number,
  userInstruction?: string,
): Promise<
  | { success: true; oldWordCount: number | null; newWordCount: number; summary: string }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return regenerateChapterContent(projectId, userId, chapterNumber, userInstruction);
}

export async function pauseWriting(
  projectId: string,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const { getProjectForUser } = await import("@/lib/db/get-project-for-user");
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    return { success: false, error: { code: "ACCESS_DENIED", message: "Project not found." } };
  }

  return pauseWritingJob(projectId);
}

export async function resumeWriting(
  projectId: string,
  fromChapter: number,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const { getProjectForUser } = await import("@/lib/db/get-project-for-user");
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    return { success: false, error: { code: "ACCESS_DENIED", message: "Project not found." } };
  }

  return resumeWritingJob(projectId, fromChapter);
}