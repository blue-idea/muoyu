/**
 * GET /api/projects/[projectId]/chapters/[chapterNumber]/content
 *
 * EARS: REQ-012-AC-001 加载章节 Markdown 正文
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; chapterNumber: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId, chapterNumber } = await params;

  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "PROJECT_NOT_FOUND", message: "Project not found." } },
      { status: 404 },
    );
  }

  const db = getDb();
  const storage = createStorageDriver();

  const [project] = await db
    .select({ storagePrefix: projects.storagePrefix })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
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

  const chapterFileName = `第${String(chapterNum).padStart(2, "0")}章-.md`;
  const r2Key = `${project.storagePrefix}${chapterFileName}`;

  try {
    const content = await storage.readText(r2Key);
    return NextResponse.json({ success: true, content });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "STORAGE_IO_ERROR", message: "Chapter not found." } },
      { status: 404 },
    );
  }
}