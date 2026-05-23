/**
 * Dashboard Page
 *
 * EARS-2: REQ-002-AC-001 仅展示当前用户作品
 * EARS-3: REQ-002-AC-004 越权访问拒绝
 * EARS-4: REQ-002-AC-007 draft 项目点击跳转向导（不是新建）
 * EARS-5: REQ-002-AC-002 writing 状态展示续写入口 + 章节进度
 * EARS-6: REQ-002-AC-005 planning 状态展示"继续确认规划"入口
 */

import { Suspense } from "react";

import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectService, type ProjectListItem } from "@/lib/projects/project-service";
import { DashboardContent } from "./dashboard-content";
import { DashboardSkeleton } from "./dashboard-skeleton";

// ---------------------------------------------------------------------------
// Server Component
// ---------------------------------------------------------------------------

async function loadProjects(userId: string): Promise<ProjectListItem[]> {
  const service = getProjectService();
  return service.getProjectsForDashboard(userId);
}

export default async function DashboardPage() {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const projects = await loadProjects(userId);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            My Works
          </h1>
          <Link
            href="/projects/new"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + New Project
          </Link>
        </div>

        {/* Project List */}
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent projects={projects} />
        </Suspense>
      </div>
    </div>
  );
}