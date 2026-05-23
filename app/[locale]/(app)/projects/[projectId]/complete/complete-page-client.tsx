"use client";

/**
 * 完成页客户端组件
 *
 * EARS: REQ-012-AC-002 统计 + 阅读/编辑/导出入口
 */

import { Button } from "@/components/ui/button";

interface CompletePageClientProps {
  projectId: string;
  locale: string;
  projectName: string;
  status: string;
}

export function CompletePageClient({
  projectId,
  locale,
  projectName,
  status,
}: CompletePageClientProps) {
  const isCompleted = status === "completed";

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* 标题区 */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {isCompleted ? "Novel Completed!" : "Validation In Progress..."}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{projectName}</p>
      </div>

      {/* 统计卡片 */}
      <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Chapters" value="--" />
        <StatCard label="Total Words" value="--" />
        <StatCard label="Passed" value="--" />
        <StatCard label="Failed" value="--" />
      </div>

      {/* 操作入口 */}
      <div className="flex flex-col gap-4 md:flex-row">
        <Button asChild className="flex-1">
          <a href={`/${locale}/projects/${projectId}/read`}>📖 Read Online</a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={`/${locale}/projects/${projectId}/edit/1`}>✏️ Edit Chapter</a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={`/${locale}/projects/${projectId}/export`}>📦 Export Book</a>
        </Button>
      </div>

      {/* 警告提示 */}
      {!isCompleted && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <p className="text-sm">
            Validation is still in progress. Please check back later.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}