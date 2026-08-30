// Delade skeleton-byggstenar för loading.tsx-filerna. Next.js visar dessa
// direkt vid navigering (streaming) medan servern hämtar sidans riktiga
// data, så klick känns omedelbara istället för att hela vyn fryser tills
// allt är klart. Formerna är medvetet lika respektive sidas riktiga layout
// så bytet från skeleton → riktigt innehåll inte hoppar till.

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/[0.05] ${className ?? ""}`}
    />
  );
}

export function StatCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <Pulse className="h-3 w-24 mb-3" />
          <Pulse className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-3.5">
          <div className="flex-1">
            <Pulse className="h-3.5 w-40 mb-2" />
            <Pulse className="h-3 w-24" />
          </div>
          <Pulse className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <Pulse className="h-7 w-40 mb-2" />
        <Pulse className="h-3.5 w-56" />
      </div>
      <Pulse className="h-9 w-64 rounded-lg" />
    </div>
  );
}

// Approximerar TopNav under laddning (loading.tsx renderas UTANFÖR
// AppShell/TopNav, så utan denna skulle hela navigeringsraden försvinna
// och layouten hoppa vid varje sidbyte — det såg sämre ut än ingen
// loading-state alls). Höjd och struktur matchar TopNav exakt.
export function TopNavSkeleton() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-neutral-950/70 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-6">
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-950/50">
              S
            </span>
            <span className="text-white font-semibold tracking-tight">
              SABBA
            </span>
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Pulse className="h-7 w-16" />
            <Pulse className="h-7 w-16" />
            <Pulse className="h-7 w-20" />
          </div>
          <Pulse className="h-7 w-7 rounded-full shrink-0" />
        </div>
      </div>
    </header>
  );
}

export function PageSkeleton({
  statCards,
  rows,
}: {
  statCards?: number;
  rows?: number;
}) {
  return (
    <div className="min-h-screen">
      <TopNavSkeleton />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeaderSkeleton />
        {statCards ? <StatCardsSkeleton count={statCards} /> : null}
        {rows ? <ListSkeleton rows={rows} /> : null}
      </main>
    </div>
  );
}
