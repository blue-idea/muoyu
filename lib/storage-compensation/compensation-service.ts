/**
 * Storage Compensation Service
 *
 * 扫描 storage_delete_pending 表，重试 R2 删除失败的存储对象
 * EARS: REQ-002, REQ-007
 */

import { getDb } from "@/lib/db";
import { storageDeletePending } from "@/drizzle/schema/jobs";
import { createStorageDriver } from "@/lib/storage";
import { eq, and, lte, isNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRY_COUNT = 5;
const RETRY_DELAY_MS = 60 * 1000; // 1 分钟后重试

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompensationResult {
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Core compensation logic
// ---------------------------------------------------------------------------

/**
 * 处理待删除存储对象的补偿Job
 *
 * 扫描 storage_delete_pending 表，对超过重试时间的条目执行删除
 */
export async function processStorageDeletePending(): Promise<CompensationResult> {
  const db = getDb();
  const storage = createStorageDriver();

  const now = new Date();

  // 查找待处理的条目（resolvedAt 为空，重试次数未达上限，下次重试时间已到）
  const pendingItems = await db
    .select()
    .from(storageDeletePending)
    .where(
      and(
        isNull(storageDeletePending.resolvedAt),
        lte(storageDeletePending.nextRetryAt, now),
      ),
    )
    .limit(20); // 每批处理 20 条

  const result: CompensationResult = {
    processedCount: pendingItems.length,
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  for (const item of pendingItems) {
    try {
      // 尝试从 R2 删除（使用 deletePrefix 递归删除）
      await storage.deletePrefix(item.storageKey);

      // 标记为已解决
      await db
        .update(storageDeletePending)
        .set({
          resolvedAt: new Date(),
        })
        .where(eq(storageDeletePending.id, item.id));

      result.successCount++;
    } catch (err) {
      // 删除失败，增加重试计数
      const newAttemptCount = item.attemptCount + 1;
      const lastError = err instanceof Error ? err.message : "Unknown error";

      if (newAttemptCount >= MAX_RETRY_COUNT) {
        // 达到最大重试次数，标记为放弃
        await db
          .update(storageDeletePending)
          .set({
            attemptCount: newAttemptCount,
            lastError,
            resolvedAt: new Date(), // 标记为已解决（尽管是失败）
          })
          .where(eq(storageDeletePending.id, item.id));

        result.errors.push(`Failed after ${MAX_RETRY_COUNT} attempts: ${item.storageKey}: ${lastError}`);
        result.failureCount++;
      } else {
        // 安排下次重试
        const nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS);

        await db
          .update(storageDeletePending)
          .set({
            attemptCount: newAttemptCount,
            lastError,
            nextRetryAt,
          })
          .where(eq(storageDeletePending.id, item.id));

        result.errors.push(`Retry ${newAttemptCount}/${MAX_RETRY_COUNT}: ${item.storageKey}: ${lastError}`);
      }
    }
  }

  return result;
}

/**
 * 将存储 key 加入待删除队列
 *
 * 用于在 R2 删除失败时，将 key 加入重试队列
 */
export async function enqueueStorageDelete(
  storageKey: string,
  delayMs = RETRY_DELAY_MS,
): Promise<{ success: true; id: string }> {
  const db = getDb();
  const nextRetryAt = new Date(Date.now() + delayMs);

  const [record] = await db
    .insert(storageDeletePending)
    .values({
      storageKey,
      attemptCount: 0,
      nextRetryAt,
    })
    .returning();

  return { success: true, id: record.id };
}

/**
 * 手动触发指定 storageKey 的删除补偿
 */
export async function compensateDeleteNow(
  storageKey: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const storage = createStorageDriver();
    await storage.deletePrefix(storageKey);

    // 标记为已解决
    const db = getDb();
    await db
      .update(storageDeletePending)
      .set({ resolvedAt: new Date() })
      .where(eq(storageDeletePending.storageKey, storageKey));

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    return { success: false, error: message };
  }
}