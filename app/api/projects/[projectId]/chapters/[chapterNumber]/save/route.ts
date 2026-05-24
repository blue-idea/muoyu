/**
 * POST /api/projects/[projectId]/chapters/[chapterNumber]/save
 *
 * EARS: REQ-013-AC-001/005/006
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { saveChapter } from "@/lib/editor/editor-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; chapterNumber: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId, chapterNumber } = await params;

  let body: { content?: string; confirmWordCountWarning?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const { content, confirmWordCountWarning } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "content is required." } },
      { status: 400 },
    );
  }

  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } },
      { status: 404 },
    );
  }

  const chapterNum = parseInt(chapterNumber, 10);
  if (isNaN(chapterNum)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid chapter number." } },
      { status: 400 },
    );
  }

  const result = await saveChapter({
    projectId,
    userId,
    chapterNumber: chapterNum,
    content,
    confirmWordCountWarning,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }

  return NextResponse.json(result);
}