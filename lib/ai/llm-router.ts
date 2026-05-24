/**
 * LLM Router
 *
 * EARS: REQ-014-AC-001 用户配置优先，平台默认降级
 */

import { getDb } from "@/lib/db";
import { userLlmConfigs } from "@/drizzle/schema/llm";
import { eq } from "drizzle-orm";
import type { LLMClient } from "./types";
import { OpenAICompatibleClient } from "./client";

// ---------------------------------------------------------------------------
// Platform Default Config
// ---------------------------------------------------------------------------

export interface PlatformLLMConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

function getPlatformConfig(): PlatformLLMConfig {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const modelName = process.env.LLM_MODEL_NAME;

  if (!baseUrl || !apiKey || !modelName) {
    throw new Error("Missing platform LLM configuration. Set LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_NAME.");
  }

  return { baseUrl, apiKey, modelName };
}

// ---------------------------------------------------------------------------
// Get LLM Client for User
// ---------------------------------------------------------------------------

/**
 * 获取用户的 LLM 客户端
 * 优先使用用户自定义配置，否则使用平台默认
 */
export async function getLLMClientForUser(
  userId: string,
  _projectId?: string,
): Promise<LLMClient> {
  const db = getDb();

  // 1. 尝试获取用户的默认 LLM 配置
  const [userConfig] = await db
    .select({
      id: userLlmConfigs.id,
      baseUrl: userLlmConfigs.baseUrl,
      encryptedApiKey: userLlmConfigs.encryptedApiKey,
      modelName: userLlmConfigs.modelName,
    })
    .from(userLlmConfigs)
    .where(eq(userLlmConfigs.userId, userId))
    .limit(1);

  // 2. 使用用户配置或平台默认
  if (userConfig) {
    // TODO: AES 解密 encryptedApiKey
    return new OpenAICompatibleClient({
      baseUrl: userConfig.baseUrl,
      apiKey: userConfig.encryptedApiKey,
      modelName: userConfig.modelName,
    });
  }

  // 降级到平台默认
  const platformConfig = getPlatformConfig();
  return new OpenAICompatibleClient({
    baseUrl: platformConfig.baseUrl,
    apiKey: platformConfig.apiKey,
    modelName: platformConfig.modelName,
  });
}

/**
 * 获取平台默认 LLM 客户端
 */
export function getDefaultLLMClient(): LLMClient {
  const config = getPlatformConfig();
  return new OpenAICompatibleClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    modelName: config.modelName,
  });
}

/**
 * 测试 LLM 配置是否可用
 */
export async function testLLMConfig(config: {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = new OpenAICompatibleClient(config);
    const success = await client.ping();
    if (success) {
      return { ok: true };
    }
    return { ok: false, error: "LLM connection test failed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}