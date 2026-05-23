/**
 * 完成页（Phase 4 校验完成后展示）
 *
 * EARS: REQ-012-AC-002 统计 + 阅读/编辑/导出入口
 */

import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { getDb } from "@/lib/db";
import { projects } from "@/drizzle/schema/projects";
import { eq } from "drizzle-orm";
import { CompletePageClient } from "./complete-page-client";

interface CompletePageProps {
  params: Promise<{ projectId: string; locale: string }>;
}

export default async function CompletePage({ params }: CompletePageProps) {
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
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    redirect("/dashboard");
  }

  return (
    <CompletePageClient
      projectId={projectId}
      locale={locale}
      projectName={project.title}
      status={project.status}
    />
  );
}