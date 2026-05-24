/**
 * Writing Progress Page (Manual Mode)
 *
 * EARS: REQ-010-AC-010~014
 */

import { Suspense } from "react";
import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/db/require-user";
import { WritePageClient } from "./write-page-client";
import { WritePageSkeleton } from "./write-page-skeleton";

export default async function WritePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await auth();
  const { id: userId } = requireUser(session);
  const { projectId } = await params;

  return (
    <Suspense fallback={<WritePageSkeleton />}>
      <WritePageClient projectId={projectId} />
    </Suspense>
  );
}
