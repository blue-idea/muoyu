"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import {
  getPreferences,
  updatePreferences,
  resetPreferences,
  type Layer1Fields,
  type Layer2Fields,
} from "@/lib/preferences/preference-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreferencesUpdateResult =
  | { success: true }
  | { error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// 错误码定义
// ---------------------------------------------------------------------------

const ERROR_CODES = {
  UNAUTHORIZED: "unauthorized",
  UPDATE_FAILED: "updateFailed",
  RESET_FAILED: "resetFailed",
  NOT_FOUND: "notFound",
} as const;

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * 获取当前用户 ID（供前端路由跳转判断）
 * EARS-4: 未登录用户访问偏好设置 → 跳转登录页
 */
export async function getCurrentUserIdAction(): Promise<{ userId: string | null }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { userId: null };
  }
  return { userId: session.user.id };
}

/**
 * 获取用户偏好（供设置页读取）
 *
 * EARS-2: 打开向导时预填偏好字段，可视化标记偏好选项（通过 readPath 调用）
 */
export async function getPreferencesAction(): Promise<
  | { success: true; preferences: Awaited<ReturnType<typeof getPreferences>> }
  | { error: { code: string; message: string } }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to manage preferences.",
      },
    };
  }

  try {
    const prefs = await getPreferences(session.user.id);
    return { success: true, preferences: prefs };
  } catch (err) {
    console.error("[getPreferencesAction] failed:", err);
    return {
      error: {
        code: ERROR_CODES.UPDATE_FAILED,
        message: "Failed to load preferences. Please try again.",
      },
    };
  }
}

/**
 * 更新用户偏好（L1/L2 静默合并）
 *
 * EARS-1: L1/L2 提交时静默更新偏好存储（无需显式保存）
 */
export async function updatePreferencesAction(
  layer1?: Layer1Fields,
  layer2?: Layer2Fields,
): Promise<PreferencesUpdateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to manage preferences.",
      },
    };
  }

  try {
    await updatePreferences(session.user.id, layer1, layer2);
    return { success: true };
  } catch (err) {
    console.error("[updatePreferencesAction] failed:", err);
    return {
      error: {
        code: ERROR_CODES.UPDATE_FAILED,
        message: "Failed to update preferences. Please try again.",
      },
    };
  }
}

/**
 * 重置用户偏好为默认值
 *
 * EARS-3: 重置偏好恢复默认值
 */
export async function resetPreferencesAction(): Promise<PreferencesUpdateResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
        message: "Please sign in to manage preferences.",
      },
    };
  }

  try {
    await resetPreferences(session.user.id);
    return { success: true };
  } catch (err) {
    console.error("[resetPreferencesAction] failed:", err);
    return {
      error: {
        code: ERROR_CODES.RESET_FAILED,
        message: "Failed to reset preferences. Please try again.",
      },
    };
  }
}