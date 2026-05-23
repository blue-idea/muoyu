/**
 * Planning Jobs API
 *
 * 规划任务管理接口
 *
 * POST /api/projects/[projectId]/planning-jobs  - 创建规划任务
 * GET  /api/projects/[projectId]/planning-jobs  - 查询项目最新规划任务状态
 *
 * EARS-1: REQ-008-AC-001 创建 planning_jobs 记录
 * EARS-3: REQ-008-AC-007 planning_ready 标志
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  createPlanningJob,
  getLatestPlanningJobForProject,
  type JobStatus,
} from "@/lib/planning/planning-service";
import { getProjectForUser } from "@/lib/db/get-project-for-user";

/**
 * POST /api/projects/[projectId]/planning-jobs
 * 创建规划任务
 *
 * 前置条件：
 * - 用户已登录
 * - 项目已通过 L3（标题已选定）
 * - 项目状态为 draft 或 planning
 *
 * 行为：
 * - 创建 planning_jobs 记录
 * - 返回任务 ID 和状态
 *
 * EARS-1: REQ-008-AC-001 创建 planning_jobs 记录
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId } = await params;

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
    const result = await createPlanningJob(projectId, userId);

    return NextResponse.json({
      success: true,
      job: {
        id: result.jobId,
        projectId: result.projectId,
        status: result.status,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PLANNING_JOB_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "A planning job already exists for this project" },
        { status: 409 },
      );
    }

    console.error("[planning-jobs POST] error:", err);
    return NextResponse.json(
      { error: "Failed to create planning job" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/projects/[projectId]/planning-jobs
 * 查询项目最新规划任务状态
 *
 * 返回项目最新的规划任务（如果存在）
 *
 * EARS-3: REQ-008-AC-007 planning_ready 标志
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId } = await params;

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
    const job = await getLatestPlanningJobForProject(projectId, userId);

    if (!job) {
      return NextResponse.json({
        success: true,
        job: null,
      });
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
      },
    });
  } catch (err) {
    console.error("[planning-jobs GET] error:", err);
    return NextResponse.json(
      { error: "Failed to get planning job" },
      { status: 500 },
    );
  }
}