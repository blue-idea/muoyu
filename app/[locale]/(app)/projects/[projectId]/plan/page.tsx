/**
 * L4 规划确认页 - 规划预览与模式选择
 *
 * EARS-1: REQ-009-AC-001 前5章摘要
 * EARS-2: REQ-009-AC-002 全文折叠可展开
 * EARS-3: REQ-009-AC-003 知识库勾选
 * EARS-4: REQ-009-AC-004 serial/parallel + auto/manual 选择
 * EARS-5: REQ-009-AC-005 creationPace=auto → generation_jobs
 */
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

import { getPlanPageData, getChapterSummaries } from "@/app/actions/plan";
import { PlanPageClient } from "./PlanPageClient";

interface PlanPageProps {
  params: Promise<{
    projectId: string;
    locale: string;
  }>;
}

export default async function PlanPage({ params }: PlanPageProps) {
  // 登录校验
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { projectId } = await params;

  // 获取规划页数据
  const planResult = await getPlanPageData(projectId);
  if (!("success" in planResult) || !planResult.success) {
    redirect("/dashboard");
  }

  const { data } = planResult;

  // 获取前5章摘要
  const summariesResult = await getChapterSummaries(projectId, 5);
  const summaries =
    "success" in summariesResult && summariesResult.success ? summariesResult.summaries : [];

  return (
    <PlanPageClient
      projectId={data.projectId}
      projectTitle={data.projectTitle}
      totalChapters={data.totalChapters}
      outlineContent={data.outlineContent}
      writingPlanContent={data.writingPlanContent}
      boundKnowledgeDocs={data.boundKnowledgeDocs}
      allKnowledgeDocs={data.allKnowledgeDocs}
      summaries={summaries}
    />
  );
}