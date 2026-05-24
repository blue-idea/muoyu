"use server";

/**
 * Storage Compensation Server Actions
 *
 * 存储删除补偿 Job 触发器
 * EARS: REQ-002, REQ-007
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  processStorageDeletePending,
  enqueueStorageDelete,
  compensateDeleteNow,
} from "@/lib/storage-compensation/compensation-service";

/**
 * 触发存储删除补偿处理
 *
 * 由 cron 或手动触发，扫描并处理 pending 列表
 */
export async function triggerStorageCompensation(): Promise<{
  success: true;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: string[];
} | { success: false; error: string }> {
  // 目前暂不验证，内部服务调用
  // TODO: 添加环境变量验证
  const result = await processStorageDeletePending();
  return {
    success: true,
    processedCount: result.processedCount,
    successCount: result.successCount,
    failureCount: result.failureCount,
    errors: result.errors,
  };
}

/**
 * 将存储 key 加入待删除队列
 */
export async function enqueueDelete(
  storageKey: string,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await auth();
  requireUser(session);

  return enqueueStorageDelete(storageKey);
}

/**
 * 手动触发立即删除补偿
 */
export async function triggerDeleteNow(
  storageKey: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await auth();
  requireUser(session);

  return compensateDeleteNow(storageKey);
}