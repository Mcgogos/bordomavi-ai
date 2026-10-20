export default function DashboardLoading() {
  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 animate-pulse select-none">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted/60 rounded-lg"></div>
          <div className="h-4 w-72 bg-muted/40 rounded-md"></div>
        </div>
        <div className="h-8 w-36 bg-muted/50 rounded-full self-start sm:self-auto"></div>
      </div>

      {/* Hero / Banner card skeleton */}
      <div className="h-28 w-full rounded-2xl bg-card border border-border/60 p-5 flex items-center justify-between">
        <div className="space-y-2.5">
          <div className="h-5 w-40 bg-muted/60 rounded-md"></div>
          <div className="h-3.5 w-64 bg-muted/40 rounded-md"></div>
        </div>
        <div className="h-9 w-28 bg-muted/60 rounded-lg"></div>
      </div>

      {/* 4 KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-card border border-border/70 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-20 bg-muted/60 rounded-sm"></div>
              <div className="w-8 h-8 rounded-lg bg-muted/60"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-7 w-16 bg-muted/80 rounded-md"></div>
              <div className="h-3 w-28 bg-muted/40 rounded-sm"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Content list / Table skeleton */}
      <div className="bg-card border border-border/70 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="h-5 w-32 bg-muted/60 rounded-md"></div>
          <div className="h-8 w-24 bg-muted/50 rounded-lg"></div>
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-14 w-full rounded-lg bg-muted/30 border border-border/30 flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-muted/60"></div>
                <div className="space-y-1.5">
                  <div className="h-4 w-48 sm:w-80 bg-muted/60 rounded-md"></div>
                  <div className="h-3 w-32 bg-muted/40 rounded-sm"></div>
                </div>
              </div>
              <div className="h-6 w-20 bg-muted/50 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
