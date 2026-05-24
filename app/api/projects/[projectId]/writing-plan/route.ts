/**
 * GET /api/projects/[projectId]/writing-plan
 *
 * 返回写作计划（用于创作进度页面）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createStorageDriver } from "@/lib/storage";
import { PLANNING_FILE_NAME } from "@/config/paths";

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

  const project = await getProjectForUser(projectId, userId);
  const storage = createStorageDriver();

  try {
    const planContent = await storage.readText(`${project.storagePrefix}${PLANNING_FILE_NAME}`);
    const writingPlan = JSON.parse(planContent);

    return NextResponse.json({
      success: true,
      writingPlan: {
        creationPace: writingPlan.creationPace,
        writingMode: writingPlan.writingMode,
        chapters: writingPlan.chapters ?? [],
      },
    });
  } catch {
    return NextResponse.json({
      success: true,
      writingPlan: null,
    });
  }
}
