/**
 * 单个规划任务查询 API
 *
 * GET /api/projects/[projectId]/planning-jobs/[jobId] - 查询单个规划任务状态
 *
 * EARS-1: REQ-008-AC-007 planning_ready 后跳转 L4
 * EARS-2: REQ-008-AC-008 轮询 UI 显示状态
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getPlanningJobStatus } from "@/lib/planning/planning-service";
import { getProjectForUser } from "@/lib/db/get-project-for-user";

/**
 * GET /api/projects/[projectId]/planning-jobs/[jobId]
 * 查询单个规划任务状态
 *
 * 行为：
 * - 校验项目归属
 * - 校验任务归属（通过 userId 在 service 层校验）
 * - 返回任务状态、进度、错误信息
 *
 * EARS-2: REQ-008-AC-008 轮询 UI 显示状态
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; jobId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId, jobId } = await params;

  // 校验项目归属
  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  try {
    const job = await getPlanningJobStatus(jobId, userId);

    if (!job) {
      return NextResponse.json(
        { error: "Planning job not found" },
        { status: 404 },
      );
    }

    // 再次确认 job 属于该项目（service 层只校验了 userId）
    if (job.projectId !== projectId) {
      return NextResponse.json(
        { error: "Planning job not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        attemptCount: job.attemptCount,
        lastError: job.lastError,
        startedAt: job.startedAt?.toISOString() ?? null,
        completedAt: job.completedAt?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[planning-jobs/[jobId] GET] error:", err);
    return NextResponse.json(
      { error: "Failed to get planning job" },
      { status: 500 },
    );
  }
}