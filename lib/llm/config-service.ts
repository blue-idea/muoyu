/**
 * LLM Config Service
 *
 * 用户 LLM 配置管理：存储、读取、测试
 * EARS: REQ-014-AC-001~004
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { userLlmConfigs } from "@/drizzle/schema/llm";
import { eq, and } from "drizzle-orm";
import { OpenAICompatibleClient } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMConfigInput {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  isDefault?: boolean;
}

export interface LLMConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  isDefault: boolean;
  lastTestedAt: Date | null;
  createdAt: Date;
}

export interface SaveConfigOutput {
  success: true;
  configId: string;
}

export interface TestConfigOutput {
  success: true;
  message: string;
}

export interface ConfigError {
  success: false;
  error: { code: string; message: string };
}

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

/**
 * 使用 AES-256-GCM 加密 API Key
 * 密钥来自 LLM_ENCRYPTION_KEY 环境变量
 */
function getEncryptionKey(): Buffer {
  const key = process.env.LLM_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("LLM_ENCRYPTION_KEY environment variable is not set.");
  }
  // 必须是 32 字节的十六进制字符串 (64 hex chars = 32 bytes)
  return Buffer.from(key, "hex");
}

/**
 * 加密 API Key
 */
export function encryptApiKey(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // 格式: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * 解密 API Key
 */
export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted API key format.");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encryptedText = parts[2];

  // pass authTagLength in options to satisfy Semgrep gcm-no-tag-length rule
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  // Enforce expected tag length before verification to prevent GCM short-tag attack
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * 测试 API Key 连接
 */
export async function testLLMConnection(
  baseUrl: string,
  apiKey: string,
  modelName: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const client = new OpenAICompatibleClient({ baseUrl, apiKey, modelName });
    const pong = await client.ping();

    if (pong) {
      return { success: true };
    } else {
      return { success: false, error: "Connection test failed: no response from model." };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection test failed.";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Config operations
// ---------------------------------------------------------------------------

/**
 * 保存用户 LLM 配置
 *
 * EARS: REQ-014-AC-001 API Key 加密存储
 * EARS: REQ-014-AC-003 使用用户配置
 */
export async function saveLLMConfig(
  userId: string,
  input: LLMConfigInput,
): Promise<SaveConfigOutput | ConfigError> {
  const db = getDb();

  // 加密 API Key
  let encryptedApiKey: string;
  try {
    encryptedApiKey = encryptApiKey(input.apiKey);
  } catch {
    return {
      success: false,
      error: { code: "LLM_CONFIG_INVALID", message: "Failed to encrypt API key." },
    };
  }

  // 如果设为默认，先取消其他默认
  if (input.isDefault) {
    await db
      .update(userLlmConfigs)
      .set({ isDefault: false })
      .where(and(eq(userLlmConfigs.userId, userId), eq(userLlmConfigs.isDefault, true)));
  }

  // 插入或更新
  const [record] = await db
    .insert(userLlmConfigs)
    .values({
      userId,
      name: input.name,
      baseUrl: input.baseUrl,
      encryptedApiKey,
      modelName: input.modelName,
      isDefault: input.isDefault ?? false,
    })
    .returning();

  return { success: true, configId: record.id };
}

/**
 * 获取用户的所有 LLM 配置（不含明文 API Key）
 */
export async function getUserLLMConfigs(
  userId: string,
): Promise<{ success: true; configs: LLMConfig[] } | ConfigError> {
  const db = getDb();

  const configs = await db
    .select({
      id: userLlmConfigs.id,
      name: userLlmConfigs.name,
      baseUrl: userLlmConfigs.baseUrl,
      modelName: userLlmConfigs.modelName,
      isDefault: userLlmConfigs.isDefault,
      lastTestedAt: userLlmConfigs.lastTestedAt,
      createdAt: userLlmConfigs.createdAt,
    })
    .from(userLlmConfigs)
    .where(eq(userLlmConfigs.userId, userId))
    .orderBy(userLlmConfigs.createdAt);

  return {
    success: true,
    configs: configs.map((c) => ({
      ...c,
      isDefault: Boolean(c.isDefault),
    })),
  };
}

/**
 * 测试指定配置
 */
export async function testLLMConfig(
  configId: string,
  userId: string,
): Promise<TestConfigOutput | ConfigError> {
  const db = getDb();

  const [config] = await db
    .select()
    .from(userLlmConfigs)
    .where(and(eq(userLlmConfigs.id, configId), eq(userLlmConfigs.userId, userId)))
    .limit(1);

  if (!config) {
    return { success: false, error: { code: "LLM_CONFIG_INVALID", message: "Config not found." } };
  }

  // 解密 API Key
  let apiKey: string;
  try {
    apiKey = decryptApiKey(config.encryptedApiKey);
  } catch {
    return { success: false, error: { code: "LLM_CONFIG_INVALID", message: "Failed to decrypt API key." } };
  }

  // 测试连接
  const result = await testLLMConnection(config.baseUrl, apiKey, config.modelName);

  if (!result.success) {
    return { success: false, error: { code: "LLM_TEST_FAILED", message: result.error } };
  }

  // 更新测试时间
  await db
    .update(userLlmConfigs)
    .set({ lastTestedAt: new Date() })
    .where(eq(userLlmConfigs.id, configId));

  return { success: true, message: "Connection successful." };
}

/**
 * 删除 LLM 配置
 */
export async function deleteLLMConfig(
  configId: string,
  userId: string,
): Promise<{ success: true } | ConfigError> {
  const db = getDb();

  const [config] = await db
    .select()
    .from(userLlmConfigs)
    .where(and(eq(userLlmConfigs.id, configId), eq(userLlmConfigs.userId, userId)))
    .limit(1);

  if (!config) {
    return { success: false, error: { code: "LLM_CONFIG_INVALID", message: "Config not found." } };
  }

  await db.delete(userLlmConfigs).where(eq(userLlmConfigs.id, configId));

  return { success: true };
}

/**
 * 设置默认配置
 */
export async function setDefaultLLMConfig(
  configId: string,
  userId: string,
): Promise<{ success: true } | ConfigError> {
  const db = getDb();

  // 取消所有默认
  await db
    .update(userLlmConfigs)
    .set({ isDefault: false })
    .where(and(eq(userLlmConfigs.userId, userId), eq(userLlmConfigs.isDefault, true)));

  // 设置新的默认
  await db
    .update(userLlmConfigs)
    .set({ isDefault: true })
    .where(and(eq(userLlmConfigs.id, configId), eq(userLlmConfigs.userId, userId)));

  return { success: true };
}