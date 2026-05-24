/**
 * Export Download API
 *
 * GET /api/projects/[projectId]/exports/[exportId]/download
 * EARS: REQ-012-AC-003
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getExportContent } from "@/lib/export/export-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; exportId: string }> },
) {
  const { projectId, exportId } = await params;

  try {
    const session = await auth();
    const { id: userId } = requireUser(session);

    const result = await getExportContent(projectId, exportId, userId);

    if (!result.success) {
      return Response.json(
        { error: { code: result.error.code, message: result.error.message } },
        { status: 404 },
      );
    }

    // 根据 contentType 决定响应类型
    // MD/TXT: 直接返回文本
    // PDF/EPUB: 返回 Base64 或流式下载
    if (result.contentType === "application/pdf" || result.contentType === "application/epub+zip") {
      // Base64 解码为二进制
      const binary = Buffer.from(result.content, "base64");
      return new Response(binary, {
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="export.${result.contentType.split("/")[1]}"`,
        },
      });
    }

    return new Response(result.content, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="export.txt"`,
      },
    });
  } catch {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401 },
    );
  }
}