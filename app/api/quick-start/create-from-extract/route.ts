/**
 * Quick Start Create From Extract API
 *
 * POST /api/quick-start/create-from-extract
 * Body: {
 *   fields: ExtractedFields,
 *   path: QuickStartPath,
 *   rawDescription: string
 * }
 * Response: { redirectUrl: string }
 *
 * EARS-3: REQ-003-AC-004 提取结果页二选一
 * EARS-4: REQ-003-AC-005 "进入完整向导" → 预填 L1 → 从 L1 开始
 * EARS-4: REQ-003-AC-006 "跳过至规划" → 持久化配置 → 若无 novelName 先 L3 再 L4
 * EARS-4: REQ-003-AC-007 全空仅完整向导（已由前端保证）
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { getProjectService } from "@/lib/projects/project-service";
import type { ExtractedFields, QuickStartPath } from "@/lib/quickstart/quickstart-service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const { id: userId } = requireUser(session);

  let body: {
    fields?: ExtractedFields;
    path?: QuickStartPath;
    rawDescription?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fields, path, rawDescription } = body;

  if (!fields || !path) {
    return NextResponse.json(
      { error: "Missing fields or path" },
      { status: 400 },
    );
  }

  // 生成标题用于 slug（优先用 premise 前 50 字符，否则用描述片段）
  const titleForSlug = fields.premise?.slice(0, 50) || rawDescription?.slice(0, 50) || "untitled";
  const slug = slugify(titleForSlug) + "-" + Date.now().toString(36);

  try {
    const service = getProjectService();

    // 创建 draft 项目
    const project = await service.createProject(userId, titleForSlug, slug);

    // 构建 creationConfig 存入 DB
    const creationConfig: Record<string, unknown> = {
      layer1: {
        genre: fields.genre ?? "",
        premise: fields.premise ?? "",
        protagonistType: fields.protagonistType ?? "",
        protagonistProfession: fields.protagonistProfession ?? "",
        protagonistCorePersonality: "",
        protagonistKeySupportingCast: "",
        coreConflictType: fields.coreConflictType ?? "",
        coreConflictDriver: "",
      },
      layer2: {},
      layer3: {},
      rawDescription: rawDescription ?? "",
    };

    await service.updateCreationConfig(userId, project.id, creationConfig);

    let redirectUrl: string;

    if (path === "full-wizard") {
      // EARS-4: REQ-003-AC-005 预填 L1 → 从 L1 开始向导
      redirectUrl = `/projects/${project.id}/wizard?step=1&prefill=true`;
    } else {
      // path === "skip-to-planning"
      // EARS-4: REQ-003-AC-006 持久化配置 → 若无 title 先 L3 再 L4
      // 前端会根据项目状态重定向，这里我们统一跳向导
      // 如果有足够数据（genre + protagonistType + coreConflictType），可以尝试跳 L3
      const hasMinimumData = Boolean(
        fields.genre || fields.protagonistType || fields.coreConflictType,
      );
      if (hasMinimumData) {
        // 有数据 → 跳 L3 标题选择
        redirectUrl = `/projects/${project.id}/wizard?step=3&prefill=true`;
      } else {
        // 数据不足 → 完整向导
        redirectUrl = `/projects/${project.id}/wizard?step=1&prefill=true`;
      }
    }

    return NextResponse.json({ redirectUrl });
  } catch (err) {
    console.error("[quick-start/create-from-extract] error:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}