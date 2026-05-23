/**
 * 编辑器页面（Server Component）
 *
 * EARS: REQ-013-AC-001/005/006
 */

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createStorageDriver } from "@/lib/storage";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import { EditPageClient } from "./edit-page-client";

interface EditPageProps {
  params: Promise<{ projectId: string; locale: string; chapterNumber: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { projectId, locale, chapterNumber } = await params;
  const userId = session.user.id as string;
  const chapterNum = parseInt(chapterNumber, 10);

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

  interface ChapterItem {
    chapterNumber: number;
    title: string;
    filePath: string;
    status: string;
    wordCount?: number | null;
    wordCountPass?: boolean | null;
  }

  let chapters: ChapterItem[] = [];
  let currentChapter: ChapterItem | null = null;

  try {
    const content = await storage.readText(`${project.storagePrefix}02-写作计划.json`);
    const plan = JSON.parse(content) as { chapters: ChapterItem[] };
    chapters = plan.chapters;
    currentChapter = chapters.find((ch) => ch.chapterNumber === chapterNum) ?? null;
  } catch {
    // 写作计划不存在
  }

  let chapterContent = "";
  if (currentChapter) {
    const chapterFileName = `第${String(chapterNum).padStart(2, "0")}章-.md`;
    try {
      chapterContent = await storage.readText(`${project.storagePrefix}${chapterFileName}`);
    } catch {
      // 章节不存在
    }
  }

  let outlineContent = "";
  let characterContent = "";

  try {
    outlineContent = await storage.readText(`${project.storagePrefix}01-大纲.md`);
  } catch {
    // 大纲不存在
  }

  try {
    characterContent = await storage.readText(`${project.storagePrefix}00-人物档案.md`);
  } catch {
    // 人物档案不存在
  }

  return (
    <EditPageClient
      projectId={projectId}
      locale={locale}
      chapterNumber={chapterNum}
      chapterTitle={currentChapter?.title ?? `Chapter ${chapterNum}`}
      initialContent={chapterContent}
      chapters={chapters}
      outlineContent={outlineContent}
      characterContent={characterContent}
    />
  );
}