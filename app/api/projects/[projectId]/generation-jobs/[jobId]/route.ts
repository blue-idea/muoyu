/**
 * GET /api/projects/[projectId]/generation-jobs/[jobId]
 *
 * EARS: REQ-010-AC-007 进度轮询 API
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { getDb } from "@/lib/db";
import { generationJobs } from "@/drizzle/schema/jobs";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; jobId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId, jobId } = await params;

  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } },
      { status: 404 },
    );
  }

  const db = getDb();
  const [job] = await db
    .select({
      id: generationJobs.id,
      projectId: generationJobs.projectId,
      currentChapterNumber: generationJobs.currentChapterNumber,
      status: generationJobs.status,
      attemptCount: generationJobs.attemptCount,
      lastError: generationJobs.lastError,
      startedAt: generationJobs.startedAt,
      completedAt: generationJobs.completedAt,
    })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  if (!job) {
    return NextResponse.json(
      { success: false, error: { code: "JOB_NOT_FOUND", message: "Job not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, job });
}