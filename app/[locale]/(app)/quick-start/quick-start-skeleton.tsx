/**
 * Quick Start Skeleton
 */
export function QuickStartSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-32 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex justify-end gap-3">
          <div className="h-9 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}