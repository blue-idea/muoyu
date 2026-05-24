"use server";

/**
 * LLM Config Server Actions
 *
 * 用户自定义 AI 模型配置管理
 * EARS: REQ-014-AC-001~004
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  saveLLMConfig,
  getUserLLMConfigs,
  testLLMConfig,
  deleteLLMConfig,
  setDefaultLLMConfig,
} from "@/lib/llm/config-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SaveConfigInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  isDefault?: boolean;
}

export interface SaveConfigResult {
  success: true;
  configId: string;
}

export interface ConfigError {
  success: false;
  error: { code: string; message: string };
}

export interface LLMConfigItem {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  isDefault: boolean;
  lastTestedAt: Date | null;
  createdAt: Date;
}

export interface ListConfigsResult {
  success: true;
  configs: LLMConfigItem[];
}

export interface TestConfigResult {
  success: true;
  message: string;
}

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

export async function llmSaveConfig(
  input: SaveConfigInput,
): Promise<SaveConfigResult | ConfigError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const result = await saveLLMConfig(userId, input);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    configId: result.configId,
  };
}

// ---------------------------------------------------------------------------
// listConfigs
// ---------------------------------------------------------------------------

export async function llmListConfigs(): Promise<ListConfigsResult | ConfigError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const result = await getUserLLMConfigs(userId);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    configs: result.configs,
  };
}

// ---------------------------------------------------------------------------
// testConfig
// ---------------------------------------------------------------------------

export async function llmTestConfig(
  configId: string,
): Promise<TestConfigResult | ConfigError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  const result = await testLLMConfig(configId, userId);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    message: result.message,
  };
}

// ---------------------------------------------------------------------------
// deleteConfig
// ---------------------------------------------------------------------------

export async function llmDeleteConfig(
  configId: string,
): Promise<{ success: true } | ConfigError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return deleteLLMConfig(configId, userId);
}

// ---------------------------------------------------------------------------
// setDefault
// ---------------------------------------------------------------------------

export async function llmSetDefault(
  configId: string,
): Promise<{ success: true } | ConfigError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return setDefaultLLMConfig(configId, userId);
}