/**
 * Dashboard Loading Skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="h-9 w-28 bg-muted rounded animate-pulse" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}