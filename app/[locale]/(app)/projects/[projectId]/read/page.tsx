/**
 * 在线阅读器页面
 *
 * EARS: REQ-012-AC-001 目录 + MD 正文加载
 */

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import { ReadPageClient } from "./read-page-client";

interface ReadPageProps {
  params: Promise<{ projectId: string; locale: string }>;
}

export default async function ReadPage({ params }: ReadPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { projectId, locale } = await params;
  const userId = session.user.id as string;

  try {
    await getProjectForUser(projectId, userId);
  } catch {
    redirect("/dashboard");
  }

  const db = getDb();
  const storage = createStorageDriver();

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    redirect("/dashboard");
  }

  // 读取写作计划
  interface ChapterItem {
    chapterNumber: number;
    title: string;
    wordCount?: number;
    wordCountPass?: boolean;
    status: string;
  }

  let chapters: ChapterItem[] = [];

  try {
    const planContent = await storage.readText(
      `${project.storagePrefix}02-写作计划.json`,
    );
    const plan = JSON.parse(planContent) as { chapters: ChapterItem[] };
    chapters = plan.chapters.filter((ch) => ch.status === "completed");
  } catch {
    // 无法读取写作计划
  }

  return (
    <ReadPageClient
      projectId={projectId}
      locale={locale}
      chapters={chapters}
      initialChapter={1}
    />
  );
}