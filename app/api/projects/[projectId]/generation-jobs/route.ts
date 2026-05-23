/**
 * POST /api/projects/[projectId]/generation-jobs
 * GET /api/projects/[projectId]/generation-jobs
 *
 * EARS: REQ-010-AC-007 进度轮询 API
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { getDb } from "@/lib/db";
import { generationJobs } from "@/drizzle/schema/jobs";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/generation-jobs
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId } = await params;

  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } },
      { status: 404 },
    );
  }

  const db = getDb();
  const jobs = await db
    .select({
      id: generationJobs.id,
      projectId: generationJobs.projectId,
      currentChapterNumber: generationJobs.currentChapterNumber,
      status: generationJobs.status,
      attemptCount: generationJobs.attemptCount,
      createdAt: generationJobs.createdAt,
      completedAt: generationJobs.completedAt,
    })
    .from(generationJobs)
    .where(eq(generationJobs.projectId, projectId));

  return NextResponse.json({ success: true, jobs });
}

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/generation-jobs
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId } = await params;

  // 解析请求体
  let body: { chapterNumber?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const { chapterNumber } = body;

  if (!chapterNumber) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "chapterNumber is required." } },
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

  // 检查项目状态（必须为 writing）
  const db = getDb();
  const [project] = await db
    .select({ status: projects.status })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project || project.status !== "writing") {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_PROJECT_STATUS", message: "Project is not in writing status." } },
      { status: 400 },
    );
  }

  // 手动模式：检查是否已有在进行的 job（REQ-016-AC-001 跳章拒绝）
  const existingJobs = await db
    .select({ id: generationJobs.id, status: generationJobs.status })
    .from(generationJobs)
    .where(eq(generationJobs.projectId, projectId));

  const hasActiveJob = existingJobs.some(
    (j) => j.status === "pending" || j.status === "running",
  );

  if (hasActiveJob) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "JOB_ALREADY_ACTIVE",
          message: "An active generation job already exists. Please wait for it to complete.",
        },
      },
      { status: 409 },
    );
  }

  // 创建新 job
  const [newJob] = await db
    .insert(generationJobs)
    .values({
      projectId,
      userId,
      currentChapterNumber: chapterNumber,
      status: "pending",
    })
    .returning();

  return NextResponse.json({ success: true, job: newJob });
}