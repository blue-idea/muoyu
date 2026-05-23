"use server";

/**
 * Wizard Server Actions
 *
 * EARS-1: L1/L2 提交时静默更新偏好存储（无需显式保存）
 * EARS-2: 打开向导时预填偏好字段（通过 getWizardData 读取 creation_config）
 * EARS-3: 重置偏好恢复默认值
 * EARS-4: 未登录用户访问创作功能 → 跳转登录页（上层路由拦截）
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectService } from "@/lib/projects/project-service";
import {
  getPreferences,
  updatePreferences,
  type Layer1Fields,
  type Layer2Fields,
} from "@/lib/preferences/preference-service";
import type { WizardAllData } from "@/lib/wizard/wizard-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveLayer1Result {
  success: true;
  updatedPreferences: boolean;
}

export interface SaveLayer2Result {
  success: true;
  updatedPreferences: boolean;
}

export interface SaveLayer3Result {
  success: true;
  projectId: string;
  redirectUrl: string;
}

export interface GetWizardDataResult {
  success: true;
  data: WizardAllData | null;
  preferences: Awaited<ReturnType<typeof getPreferences>> | null;
}

export interface CreateProjectResult {
  success: true;
  projectId: string;
  redirectUrl: string;
}

// ---------------------------------------------------------------------------
// 错误码定义
// ---------------------------------------------------------------------------

const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  SAVE_FAILED: "saveFailed",
  NOT_FOUND: "notFound",
  INVALID_LAYER: "invalidLayer",
} as const;

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export type WizardError = {
  code: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Helper：获取当前用户 ID
// ---------------------------------------------------------------------------

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 保存 L1 核心层数据，同时静默更新用户偏好
 *
 * EARS-1: L1 提交时静默更新偏好存储
 */
export async function wizardSaveLayer1(
  data: {
    genre: string;
    premise: string;
    protagonistType: string;
    protagonistProfession: string;
    protagonistCorePersonality: string;
    protagonistKeySupportingCast: string;
    coreConflictType: string;
    coreConflictDriver: string;
  },
): Promise<SaveLayer1Result | { error: WizardError }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to continue.",
      },
    };
  }

  try {
    // EARS-1: 静默更新用户偏好（无需用户显式保存）
    const layer1Fields: Layer1Fields = {
      genre: data.genre,
      protagonistType: data.protagonistType,
      protagonistConflict: data.coreConflictType,
    };
    await updatePreferences(userId, layer1Fields);

    return { success: true, updatedPreferences: true };
  } catch (err) {
    console.error("[wizardSaveLayer1] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to save layer 1 data. Please try again.",
      },
    };
  }
}

/**
 * 保存 L2 深度定制层数据，同时静默更新用户偏好
 *
 * EARS-1: L2 提交时静默更新偏好存储
 */
export async function wizardSaveLayer2(
  data: {
    worldBackground: string;
    worldUniqueRules: string;
    narrativePerspective: string;
    overallTone: string;
    coreTheme: string;
    targetAudience: string;
    styleReferences: string;
    specialRequirements: string;
    chapterCount: number;
  },
): Promise<SaveLayer2Result | { error: WizardError }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to continue.",
      },
    };
  }

  try {
    // EARS-1: 静默更新用户偏好
    const layer2Fields: Layer2Fields = {
      perspective: data.narrativePerspective,
      tone: data.overallTone,
      theme: data.coreTheme,
      chapterCount: data.chapterCount,
      styleReferences: data.styleReferences ? [data.styleReferences] : [],
    };
    await updatePreferences(userId, undefined, layer2Fields);

    return { success: true, updatedPreferences: true };
  } catch (err) {
    console.error("[wizardSaveLayer2] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to save layer 2 data. Please try again.",
      },
    };
  }
}

/**
 * 保存 L3 标题层数据，完成向导后创建项目
 *
 * EARS-2: 创建项目后将 creation_config 写入 DB
 */
export async function wizardSaveLayer3(
  data: {
    selectedTitle: string;
    candidates: string[];
    layer1Data: {
      genre: string;
      premise: string;
      protagonistType: string;
      protagonistProfession: string;
      protagonistCorePersonality: string;
      protagonistKeySupportingCast: string;
      coreConflictType: string;
      coreConflictDriver: string;
    };
    layer2Data: {
      worldBackground: string;
      worldUniqueRules: string;
      narrativePerspective: string;
      overallTone: string;
      coreTheme: string;
      targetAudience: string;
      styleReferences: string;
      specialRequirements: string;
      chapterCount: number;
    };
  },
): Promise<SaveLayer3Result | { error: WizardError }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to continue.",
      },
    };
  }

  try {
    const service = getProjectService();

    // 生成 slug（用于 storage_prefix）
    const slug = data.selectedTitle
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      || `novel-${Date.now()}`;

    // 构建 creation_config（符合 data.md §8.2 结构）
    const creationConfig = {
      source: "wizard",
      layer1: data.layer1Data,
      layer2: data.layer2Data,
      layer3: {
        selectedTitle: data.selectedTitle,
        candidates: data.candidates,
      },
    };

    // 创建项目（draft 状态）
    const project = await service.createProject(userId, data.selectedTitle, slug);

    // EARS-2: 将 creation_config 写入 DB
    await service.updateCreationConfig(userId, project.id, creationConfig);

    // 重定向到 L4 规划确认页
    return {
      success: true,
      projectId: project.id,
      redirectUrl: `/projects/${project.id}/planning`,
    };
  } catch (err) {
    console.error("[wizardSaveLayer3] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to save layer 3 data. Please try again.",
      },
    };
  }
}

/**
 * 获取已保存的向导数据 + 用户偏好（用于预填）
 *
 * EARS-2: 打开向导时预填偏好字段，并对偏好选项做可视化标记
 */
export async function wizardGetData(
  projectId?: string,
): Promise<GetWizardDataResult | { error: WizardError }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to continue.",
      },
    };
  }

  try {
    const service = getProjectService();

    // 如果有 projectId，读取项目的 creation_config
    if (projectId) {
      const project = await service.getProjectDetail(userId, projectId);
      const creationConfig = project.creationConfig as WizardAllData | null;

      // 读取用户偏好用于标记
      const preferences = await getPreferences(userId);

      return {
        success: true,
        data: creationConfig ?? null,
        preferences,
      };
    }

    // 无 projectId 时仅读取用户偏好（新建项目时预填）
    const preferences = await getPreferences(userId);

    return {
      success: true,
      data: null,
      preferences,
    };
  } catch (err) {
    console.error("[wizardGetData] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to load wizard data. Please try again.",
      },
    };
  }
}

/**
 * 更新项目创作配置（用于向导中途保存）
 *
 * EARS-2: 更新项目的 creation_config
 */
export async function wizardUpdateCreationConfig(
  projectId: string,
  creationConfig: WizardAllData,
): Promise<{ success: true } | { error: WizardError }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to continue.",
      },
    };
  }

  try {
    const service = getProjectService();
    await service.updateCreationConfig(
      userId,
      projectId,
      creationConfig as unknown as Record<string, unknown>,
    );
    return { success: true };
  } catch (err) {
    console.error("[wizardUpdateCreationConfig] failed:", err);
    return {
      error: {
        code: ERROR_CODES.SAVE_FAILED,
        message: "Failed to update project config. Please try again.",
      },
    };
  }
}