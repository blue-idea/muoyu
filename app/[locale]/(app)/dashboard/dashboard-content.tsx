"use client";

/**
 * Dashboard Content
 *
 * EARS-2: REQ-002-AC-001 仅展示当前用户作品
 * EARS-4: REQ-002-AC-007 draft 项目点击跳转向导（不是新建）
 * EARS-5: REQ-002-AC-002 writing 状态展示续写入口 + 章节进度
 * EARS-6: REQ-002-AC-005 planning 状态展示"继续确认规划"入口
 */

import Link from "next/link";
import type { ProjectListItem } from "@/lib/projects/project-service";

interface DashboardContentProps {
  projects: ProjectListItem[];
}

function getStatusLabel(status: ProjectListItem["status"], planningReady: boolean): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "planning":
      return planningReady ? "Plan Ready" : "Planning";
    case "writing":
      return "Writing";
    case "validating":
      return "Validating";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

function getStatusColor(status: ProjectListItem["status"]): string {
  switch (status) {
    case "draft":
      return "bg-zinc-400";
    case "planning":
      return "bg-amber-500";
    case "writing":
      return "bg-blue-500";
    case "validating":
      return "bg-purple-500";
    case "completed":
      return "bg-green-500";
    default:
      return "bg-zinc-400";
  }
}

function getActionLabel(status: ProjectListItem["status"], planningReady: boolean): string {
  switch (status) {
    case "draft":
      return "Continue Wizard";
    case "planning":
      return planningReady ? "Confirm Plan" : "Generating...";
    case "writing":
      return "Continue Writing";
    case "validating":
      return "Continue Validation";
    case "completed":
      return "Read";
    default:
      return "Open";
  }
}

function getProgressText(project: ProjectListItem): string | null {
  if (
    (project.status === "writing" || project.status === "validating") &&
    project.totalChapters != null &&
    project.totalChapters > 0
  ) {
    return `${project.chapterCompletedCount}/${project.totalChapters} chapters`;
  }
  return null;
}

function getResumeHref(project: ProjectListItem): string {
  // EARS-4: draft 跳转向导页
  if (project.status === "draft") {
    return `/projects/${project.id}/wizard`;
  }
  // EARS-6: planning + !planningReady 跳转规划页（生成中）
  if (project.status === "planning" && !project.planningReady) {
    return `/projects/${project.id}/planning`;
  }
  // EARS-6: planning + planningReady 跳转规划页（待确认）
  if (project.status === "planning" && project.planningReady) {
    return `/projects/${project.id}/planning`;
  }
  // EARS-5: writing 跳转创作进度页
  if (project.status === "writing") {
    return `/projects/${project.id}/write`;
  }
  // validating 跳转校验进度页
  if (project.status === "validating") {
    return `/projects/${project.id}/complete`;
  }
  // completed 跳转阅读器
  if (project.status === "completed") {
    return `/projects/${project.id}/read`;
  }
  return `/projects/${project.id}/wizard`;
}

export function DashboardContent({ projects }: DashboardContentProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-6xl">📚</div>
        <h2 className="mb-2 text-xl font-medium text-zinc-900 dark:text-zinc-50">
          No projects yet
        </h2>
        <p className="mb-6 text-zinc-500 dark:text-zinc-400">
          Start your creative journey by creating a new project.
        </p>
        <Link
          href="/projects/new"
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Create Your First Project
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => {
        const statusLabel = getStatusLabel(project.status, project.planningReady);
        const statusColor = getStatusColor(project.status);
        const actionLabel = getActionLabel(project.status, project.planningReady);
        const progressText = getProgressText(project);
        const resumeHref = getResumeHref(project);

        return (
          <div
            key={project.id}
            className="group relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Status badge */}
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white ${statusColor}`}
              >
                {statusLabel}
              </span>
              {project.status === "planning" && !project.planningReady && (
                <span className="text-xs text-zinc-400">
                  Generating plan...
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {project.title}
            </h3>

            {/* Slug */}
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              /{project.slug}
            </p>

            {/* Progress for writing/validating */}
            {progressText && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>{progressText}</span>
                  <span>
                    {Math.round(
                      (project.chapterCompletedCount /
                        (project.totalChapters ?? 1)) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{
                      width: `${(project.chapterCompletedCount / (project.totalChapters ?? 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="mb-4 text-xs text-zinc-400">
              Updated {new Date(project.updatedAt).toLocaleDateString()}
            </div>

            {/* Action button */}
            <a
              href={resumeHref}
              className={`block w-full rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
                project.status === "draft"
                  ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  : project.status === "planning" && !project.planningReady
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                    : "bg-zinc-900 text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              }`}
            >
              {actionLabel}
            </a>
          </div>
        );
      })}
    </div>
  );
}