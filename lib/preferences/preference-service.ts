/**
 * 用户偏好服务
 *
 * EARS-1: L1/L2 提交时静默更新偏好存储（无需显式保存）
 * EARS-2: 打开向导时预填偏好字段，可视化标记偏好选项
 * EARS-3: 重置偏好恢复默认值
 * EARS-4: 未登录用户访问偏好设置 → 跳转登录页（上层路由拦截）
 *
 * 双写策略: user_preferences 表 + R2 JSON
 * R2 路径: {userId}/preferences/user-preferences.json
 */

import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { createStorageDriver } from "@/lib/storage";
import { userPreferences } from "@/drizzle/schema/preferences";
import type { JsonObject } from "@/drizzle/schema/json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * 用户偏好 JSON 结构（对应 data.md §8.1）
 * 与 tpl/user-preferences.example.json 对齐
 */
export interface UserPreferencesJson {
  favoriteGenres: string[];
  preferredProtagonist: string;
  preferredPerspective: string;
  preferredTone: string;
  typicalChapterCount: number;
  styleReferences: string[];
  dislikes: string[];
  creationHistory: CreationHistoryEntry[];
}

export interface CreationHistoryEntry {
  projectTitle: string;
  genre: string;
  completedChapters: number;
  createdAt: string;
}

/** 默认偏好值 */
export const DEFAULT_USER_PREFERENCES: UserPreferencesJson = {
  favoriteGenres: [],
  preferredProtagonist: "",
  preferredPerspective: "",
  preferredTone: "",
  typicalChapterCount: 20,
  styleReferences: [],
  dislikes: [],
  creationHistory: [],
};

// ---------------------------------------------------------------------------
// Layer 字段映射（来自创作向导 L1/L2）
// ---------------------------------------------------------------------------

/** L1 核心层字段映射 */
export interface Layer1Fields {
  genre?: string;
  protagonistType?: string;
  protagonistConflict?: string;
}

/** L2 深度定制层字段映射 */
export interface Layer2Fields {
  perspective?: string;
  tone?: string;
  worldBackground?: string;
  theme?: string;
  chapterCount?: number;
  styleReferences?: string[];
  dislikes?: string[];
}

// ---------------------------------------------------------------------------
// R2 路径辅助
// ---------------------------------------------------------------------------

function buildPreferencesR2Key(userId: string): string {
  return `${userId}/preferences/user-preferences.json`;
}

// ---------------------------------------------------------------------------
// Service 实现
// ---------------------------------------------------------------------------

/** 读取用户偏好（优先 DB，降级 R2） */
export async function getPreferences(
  userId: string,
): Promise<UserPreferencesJson> {
  const db = getDb();

  // 优先从数据库读取
  const [row] = await db
    .select({ preferences: userPreferences.preferences })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (row && row.preferences && typeof row.preferences === "object") {
    return mergeDefaults(row.preferences as JsonObject) as UserPreferencesJson;
  }

  // DB 无记录，降级读取 R2 JSON
  const storage = createStorageDriver();
  const r2Key = buildPreferencesR2Key(userId);

  try {
    const content = await storage.readText(r2Key);
    const parsed = JSON.parse(content) as JsonObject;
    return mergeDefaults(parsed) as UserPreferencesJson;
  } catch {
    // R2 也不存在，返回默认值
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

/**
 * 静默合并 L1/L2 字段后保存（双写 DB + R2）
 *
 * EARS-1: 写入时静默合并，无需用户显式保存
 * 对齐 data.md §8.1 preferences JSON 结构
 */
export async function updatePreferences(
  userId: string,
  layer1?: Layer1Fields,
  layer2?: Layer2Fields,
): Promise<void> {
  // 读取现有偏好（可能为空）
  const existing = await getPreferences(userId);

  // 静默合并：只更新传入的字段，保留其他字段
  const merged = buildMergedPreferences(existing, layer1, layer2);

  // 双写：先写 DB，再写 R2
  await writeDbAndR2(userId, merged);
}

// ---------------------------------------------------------------------------
// 内部函数
// ---------------------------------------------------------------------------

/** 合并默认值（确保所有字段存在） */
function mergeDefaults(prefs: JsonObject): UserPreferencesJson {
  return {
    favoriteGenres: Array.isArray(prefs.favoriteGenres)
      ? (prefs.favoriteGenres as string[])
      : DEFAULT_USER_PREFERENCES.favoriteGenres,
    preferredProtagonist:
      typeof prefs.preferredProtagonist === "string"
        ? prefs.preferredProtagonist
        : DEFAULT_USER_PREFERENCES.preferredProtagonist,
    preferredPerspective:
      typeof prefs.preferredPerspective === "string"
        ? prefs.preferredPerspective
        : DEFAULT_USER_PREFERENCES.preferredPerspective,
    preferredTone:
      typeof prefs.preferredTone === "string"
        ? prefs.preferredTone
        : DEFAULT_USER_PREFERENCES.preferredTone,
    typicalChapterCount:
      typeof prefs.typicalChapterCount === "number"
        ? prefs.typicalChapterCount
        : DEFAULT_USER_PREFERENCES.typicalChapterCount,
    styleReferences: Array.isArray(prefs.styleReferences)
      ? (prefs.styleReferences as string[])
      : DEFAULT_USER_PREFERENCES.styleReferences,
    dislikes: Array.isArray(prefs.dislikes)
      ? (prefs.dislikes as string[])
      : DEFAULT_USER_PREFERENCES.dislikes,
    creationHistory: (prefs.creationHistory as unknown as CreationHistoryEntry[])
      ?? DEFAULT_USER_PREFERENCES.creationHistory,
  };
}

/** 根据 L1/L2 字段构建合并后的偏好对象 */
function buildMergedPreferences(
  existing: UserPreferencesJson,
  layer1?: Layer1Fields,
  layer2?: Layer2Fields,
): UserPreferencesJson {
  const result: UserPreferencesJson = { ...existing };

  // L1 字段合并
  if (layer1) {
    if (layer1.genre !== undefined) {
      // L1 genre → favoriteGenres（追加，不去重）
      const current = result.favoriteGenres;
      if (layer1.genre && !current.includes(layer1.genre)) {
        result.favoriteGenres = [...current, layer1.genre];
      }
    }
    if (layer1.protagonistType !== undefined) {
      result.preferredProtagonist = layer1.protagonistType;
    }
  }

  // L2 字段合并
  if (layer2) {
    if (layer2.perspective !== undefined) {
      result.preferredPerspective = layer2.perspective;
    }
    if (layer2.tone !== undefined) {
      result.preferredTone = layer2.tone;
    }
    if (layer2.chapterCount !== undefined) {
      result.typicalChapterCount = layer2.chapterCount;
    }
    if (layer2.styleReferences !== undefined) {
      result.styleReferences = layer2.styleReferences;
    }
    if (layer2.dislikes !== undefined) {
      result.dislikes = layer2.dislikes;
    }
  }

  return result;
}

/** 双写：DB + R2 */
async function writeDbAndR2(
  userId: string,
  preferences: UserPreferencesJson,
): Promise<void> {
  const db = getDb();
  const storage = createStorageDriver();
  const r2Key = buildPreferencesR2Key(userId);

  // 并行写 DB 和 R2
  await Promise.all([
    // DB UPSERT
    db
      .insert(userPreferences)
      .values({
        userId,
        preferences: preferences as unknown as JsonObject,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          preferences: preferences as unknown as JsonObject,
          updatedAt: new Date(),
        },
      }),
    // R2 JSON
    storage.writeText(r2Key, JSON.stringify(preferences, null, 2)),
  ]);
}

/** 重置偏好为默认值 */
export async function resetPreferences(userId: string): Promise<void> {
  await writeDbAndR2(userId, { ...DEFAULT_USER_PREFERENCES });
}