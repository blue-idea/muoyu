/**
 * 规划页 UI
 * EARS-1: REQ-008-AC-007 planning_ready 后跳转 L4
 * EARS-2: REQ-008-AC-008 轮询 UI 显示状态
 */
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { getProjectService } from "@/lib/projects/project-service";

interface PlanningPageProps {
  params: Promise<{ projectId: string; locale: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting...",
  running: "Generating...",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-zinc-500",
  running: "text-blue-500",
  completed: "text-green-500",
  failed: "text-red-500",
};

export default async function PlanningPage({ params }: PlanningPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const { projectId, locale } = await params;
  const service = getProjectService();
  const project = await service.getProjectDetail(session.user.id as string, projectId);

  if (project.planningReady) {
    // 已就绪，跳转 L4 确认页
    redirect(`/${locale}/projects/${projectId}/plan`);
  }

  // 获取最新规划任务
  const { getLatestPlanningJobForProject } = await import("@/lib/planning/planning-service");
  const job = await getLatestPlanningJobForProject(projectId, session.user.id as string);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold mb-8">Planning</h1>

        {job ? (
          <div className="space-y-6">
            {/* 状态指示 */}
            <div className="flex items-center gap-3">
              <div className={`text-lg font-medium ${STATUS_COLORS[job.status] ?? ""}`}>
                {STATUS_LABELS[job.status] ?? job.status}
              </div>
            </div>

            {/* 失败时显示重试按钮 */}
            {job.status === "failed" && (
              <div className="space-y-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Planning failed: {job.lastError ?? "Unknown error"}
                </p>
                <form action={`/api/projects/${projectId}/planning-jobs`} method="post">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                  >
                    Retry
                  </button>
                </form>
              </div>
            )}

            {/* 进行中提示 */}
            {job.status === "running" && (
              <p className="text-sm text-muted-foreground">
                AI is generating your story outline. This may take a few minutes...
              </p>
            )}

            {/* 完成提示 */}
            {job.status === "completed" && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Planning completed! Redirecting to confirmation...
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No planning job found. Start planning?
            </p>
            <form action={`/api/projects/${projectId}/planning-jobs`} method="post">
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
              >
                Start Planning
              </button>
            </form>
          </div>
        )}

        <div className="mt-8">
          <a
            href={`/${locale}/dashboard`}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}