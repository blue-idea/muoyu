"use server";

/**
 * Knowledge Server Actions
 *
 * 用户知识库管理 API
 * EARS: REQ-015-AC-001~005
 */

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { eq, and } from "drizzle-orm";
import { knowledgeDocuments } from "@/drizzle/schema/knowledge";
import { getDb } from "@/lib/db";
import {
  uploadDocument,
  addUrlDocument,
  listKnowledgeDocuments,
  deleteKnowledgeDocument,
  bindDocumentToProject,
  getProjectBindings,
  searchDocumentContent,
} from "@/lib/knowledge/knowledge-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadDocumentInput {
  title: string;
  fileData: string; // base64 encoded
  fileType: string;
}

export interface AddUrlInput {
  url: string;
}

export interface BindDocumentInput {
  documentId: string;
  projectId: string;
}

export interface SearchContentInput {
  documentId: string;
  query: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// uploadDocument
// ---------------------------------------------------------------------------

export async function knowledgeUploadDocument(
  input: UploadDocumentInput,
): Promise<
  | { success: true; documentId: string }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 解码 base64
  let buffer: Buffer;
  try {
    const base64Data = input.fileData.replace(/^data:[^;]+;base64,/, "");
    buffer = Buffer.from(base64Data, "base64");
  } catch {
    return { success: false, error: { code: "INVALID_FILE", message: "Failed to decode file data." } };
  }

  return uploadDocument(userId, input.title, buffer, input.fileType);
}

// ---------------------------------------------------------------------------
// addUrl
// ---------------------------------------------------------------------------

export async function knowledgeAddUrl(
  input: AddUrlInput,
): Promise<
  | { success: true; documentId: string }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 简单 URL 验证
  try {
    const url = new URL(input.url);
    if (!["http:", "https:"].includes(url.protocol)) {
      return { success: false, error: { code: "INVALID_URL", message: "Only HTTP/HTTPS URLs are supported." } };
    }
  } catch {
    return { success: false, error: { code: "INVALID_URL", message: "Invalid URL format." } };
  }

  return addUrlDocument(userId, input.url);
}

// ---------------------------------------------------------------------------
// listDocuments
// ---------------------------------------------------------------------------

export async function knowledgeListDocuments(): Promise<
  | {
      success: true;
      documents: Array<{
        id: string;
        title: string;
        sourceType: string;
        status: string;
        failureReason: string | null;
        createdAt: Date;
      }>;
    }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return listKnowledgeDocuments(userId);
}

// ---------------------------------------------------------------------------
// deleteDocument
// ---------------------------------------------------------------------------

export async function knowledgeDeleteDocument(
  documentId: string,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  return deleteKnowledgeDocument(documentId, userId);
}

// ---------------------------------------------------------------------------
// bindDocument
// ---------------------------------------------------------------------------

export async function knowledgeBindDocument(
  input: BindDocumentInput,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 验证用户对 project 的访问权限
  const { getProjectForUser } = await import("@/lib/db/get-project-for-user");
  const project = await getProjectForUser(input.projectId, userId);

  if (!project) {
    return { success: false, error: { code: "ACCESS_DENIED", message: "Project not found." } };
  }

  return bindDocumentToProject(input.documentId, input.projectId);
}

// ---------------------------------------------------------------------------
// getProjectBindings
// ---------------------------------------------------------------------------

export async function knowledgeGetProjectBindings(
  projectId: string,
): Promise<
  | {
      success: true;
      documents: Array<{
        id: string;
        title: string;
        sourceType: string;
        status: string;
        boundAt: Date;
      }>;
    }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 验证用户对 project 的访问权限
  const { getProjectForUser } = await import("@/lib/db/get-project-for-user");
  const project = await getProjectForUser(projectId, userId);

  if (!project) {
    return { success: false, error: { code: "ACCESS_DENIED", message: "Project not found." } };
  }

  return getProjectBindings(projectId);
}

// ---------------------------------------------------------------------------
// searchContent
// ---------------------------------------------------------------------------

export async function knowledgeSearchContent(
  input: SearchContentInput,
): Promise<
  | { success: true; chunks: Array<{ content: string; chunkIndex: number }> }
  | { success: false; error: { code: string; message: string } }
> {
  const session = await auth();
  const { id: userId } = requireUser(session);

  // 验证文档所有权
  const db = getDb();

  const [doc] = await db
    .select()
    .from(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, input.documentId), eq(knowledgeDocuments.userId, userId)))
    .limit(1);

  if (!doc) {
    return { success: false, error: { code: "NOT_FOUND", message: "Document not found." } };
  }

  return searchDocumentContent(input.documentId, input.query, input.limit);
}