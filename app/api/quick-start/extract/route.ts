/**
 * Quick Start Extract API
 *
 * POST /api/quick-start/extract
 * Body: { description: string }
 * Response: { success: boolean; fields: ExtractedFields }
 *
 * EARS-3: REQ-003-AC-003 从用户输入提取结构化字段
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import {
  getQuickStartService,
  type ExtractedFields,
} from "@/lib/quickstart/quickstart-service";

export async function POST(request: NextRequest) {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // Rate limit note: the global middleware handles rate limiting for /api/* paths

  let body: { description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const description = typeof body.description === "string"
    ? body.description.trim()
    : "";

  if (description.length < 5) {
    return NextResponse.json(
      { error: "Description too short" },
      { status: 400 },
    );
  }

  try {
    const service = getQuickStartService();
    const result = await service.extract(description);

    return NextResponse.json({
      success: result.success,
      fields: result.fields,
    });
  } catch (err) {
    console.error("[quick-start/extract] error:", err);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 },
    );
  }
}