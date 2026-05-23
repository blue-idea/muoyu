"use server";

/**
 * Project Server Actions
 *
 * EARS-2: REQ-002-AC-001 仅展示当前用户作品
 * EARS-3: REQ-002-AC-004 越权访问拒绝
 * EARS-4: REQ-002-AC-007 draft 项目点击跳转向导（不是新建）
 * EARS-5: REQ-002-AC-002 writing 状态展示续写入口 + 章节进度
 * EARS-6: REQ-002-AC-005 planning 状态展示"继续确认规划"入口
 */
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  getProjectService,
  type ProjectListItem,
  type ProjectDetail,
} from "@/lib/projects/project-service";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const session = await auth();
  return requireUser(session);
}

// ---------------------------------------------------------------------------
// Create Project
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  title: string;
  slug: string;
}

export interface CreateProjectResult {
  success: true;
  projectId: string;
  redirectUrl: string;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  const { id: userId } = await getAuthenticatedUser();
  const service = getProjectService();

  const project = await service.createProject(userId, input.title, input.slug);

  return {
    success: true,
    projectId: project.id,
    redirectUrl: `/projects/${project.id}/wizard`,
  };
}

// ---------------------------------------------------------------------------
// Delete Project
// ---------------------------------------------------------------------------

export interface DeleteProjectResult {
  success: boolean;
  error?: string;
}

export async function deleteProject(projectId: string): Promise<DeleteProjectResult> {
  try {
    const { id: userId } = await getAuthenticatedUser();
    const service = getProjectService();
    await service.deleteProject(userId, projectId);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Get Projects Dashboard
// ---------------------------------------------------------------------------

export interface GetProjectsDashboardResult {
  projects: ProjectListItem[];
}

export async function getProjectsDashboard(): Promise<GetProjectsDashboardResult> {
  const { id: userId } = await getAuthenticatedUser();
  const service = getProjectService();

  const projects = await service.getProjectsForDashboard(userId);

  return { projects };
}

// ---------------------------------------------------------------------------
// Get Project Detail
// ---------------------------------------------------------------------------

export interface GetProjectDetailResult {
  project: ProjectDetail | null;
  error?: string;
}

export async function getProjectDetail(
  projectId: string,
): Promise<GetProjectDetailResult> {
  try {
    const { id: userId } = await getAuthenticatedUser();
    const service = getProjectService();
    const project = await service.getProjectDetail(userId, projectId);
    return { project };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // EARS-3: 越权访问返回 null 而非错误详情
    if (message === "PROJECT_NOT_FOUND") {
      return { project: null, error: "Project not found" };
    }
    return { project: null, error: message };
  }
}

// ---------------------------------------------------------------------------
// Create New Project from Dashboard (redirect to wizard)
// ---------------------------------------------------------------------------

export async function startNewProject(): Promise<void> {
  const { id: userId } = await getAuthenticatedUser();
  const service = getProjectService();

  // Create a temporary draft project then redirect to wizard
  // The wizard will handle title/slug generation
  const tempTitle = `Draft ${new Date().toISOString().slice(0, 10)}`;
  const tempSlug = `draft-${Date.now()}`;

  const project = await service.createProject(userId, tempTitle, tempSlug);

  redirect(`/projects/${project.id}/wizard`);
}

// ---------------------------------------------------------------------------
// Get writing progress info (for dashboard cards)
// ---------------------------------------------------------------------------

export interface WritingProgressInfo {
  projectId: string;
  completedChapters: number;
  totalChapters: number;
  statusLabel: string;
}

export async function getWritingProgressInfo(
  projectId: string,
): Promise<WritingProgressInfo | null> {
  try {
    const { id: userId } = await getAuthenticatedUser();
    const service = getProjectService();
    const project = await service.getProjectDetail(userId, projectId);

    if (project.status !== "writing" && project.status !== "validating") {
      return null;
    }

    const statusLabel =
      project.status === "writing" ? "Writing" : "Validating";

    return {
      projectId: project.id,
      completedChapters: project.chapterCompletedCount,
      totalChapters: project.totalChapters ?? 0,
      statusLabel,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Get project resume URL for dashboard navigation
// ---------------------------------------------------------------------------

export interface ProjectResumeUrl {
  projectId: string;
  url: string;
  label: string;
}

export async function getProjectResumeUrl(
  projectId: string,
): Promise<ProjectResumeUrl | null> {
  try {
    const { id: userId } = await getAuthenticatedUser();
    const service = getProjectService();
    const projects = await service.getProjectsForDashboard(userId);
    const project = projects.find((p) => p.id === projectId);

    if (!project) return null;

    const { getProjectResumeRoute } = await import(
      "@/lib/projects/project-service"
    );
    const url = getProjectResumeRoute(project);

    // Determine label based on status
    let label = "Continue";
    if (project.status === "draft") label = "Continue Wizard";
    else if (project.status === "planning" && !project.planningReady) label = "Generating Plan...";
    else if (project.status === "planning" && project.planningReady) label = "Confirm Plan";
    else if (project.status === "writing") {
      label = `Writing ${project.chapterCompletedCount}/${project.totalChapters ?? 0} chapters`;
    } else if (project.status === "validating") {
      label = `Validating ${project.chapterCompletedCount}/${project.totalChapters ?? 0} chapters`;
    } else if (project.status === "completed") label = "Read";

    return { projectId, url, label };
  } catch {
    return null;
  }
}