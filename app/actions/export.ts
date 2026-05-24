"use server";

/**
 * Export Server Actions
 *
 * 四格式导出：MD / TXT / PDF / EPUB
 * EARS: REQ-012-AC-003, AC-004
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectForUser } from "@/lib/db/get-project-for-user";
import { createExport, listExports, type ExportMetadata } from "@/lib/export/export-service";
import type { ExportFormat } from "@/drizzle/schema/enums";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateExportInput {
  projectId: string;
  format: ExportFormat;
  metadata: ExportMetadata;
}

export interface CreateExportResult {
  success: true;
  exportId: string;
  downloadUrl: string;
  fileSize?: number;
}

export interface ExportError {
  success: false;
  error: { code: string; message: string };
}

export interface ListExportsResult {
  success: true;
  exports: Array<{
    id: string;
    format: ExportFormat;
    metadata: ExportMetadata;
    storageKey: string;
    fileSize?: number | null;
    createdAt: Date;
  }>;
}

// ---------------------------------------------------------------------------
// createExport
// ---------------------------------------------------------------------------

export async function exportCreate(
  input: CreateExportInput,
): Promise<CreateExportResult | ExportError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 归属校验
  try {
    await getProjectForUser(input.projectId, userId);
  } catch {
    return {
      success: false,
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found." },
    };
  }

  const result = await createExport({
    projectId: input.projectId,
    userId,
    format: input.format,
    metadata: input.metadata,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    exportId: result.exportId,
    downloadUrl: result.downloadUrl,
    fileSize: result.fileSize,
  };
}

// ---------------------------------------------------------------------------
// listExports
// ---------------------------------------------------------------------------

export async function exportList(
  projectId: string,
): Promise<ListExportsResult | ExportError> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 归属校验
  try {
    await getProjectForUser(projectId, userId);
  } catch {
    return {
      success: false,
      error: { code: "PROJECT_NOT_FOUND", message: "Project not found." },
    };
  }

  const result = await listExports({ projectId, userId });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    exports: result.exports,
  };
}