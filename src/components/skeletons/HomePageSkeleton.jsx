// components/skeletons/HomePageSkeleton.jsx
//
// Mirrors HomePage's exact section structure/spacing so swapping real
// content in causes zero layout shift. Uses the same className scaffolding
// (mx-auto max-w-7xl px-4 pb-10 pt-3, mt-5 section rhythm, etc).

export default function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 lg:px-8">
      <SearchWalletRowSkeleton />
      <PromoCarouselSkeleton />
      <WelcomeBannerSkeleton />
      <SectionSkeleton title>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2.5">
              <div className="flex items-stretch gap-2">
                <Shimmer className="aspect-square w-11 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <Shimmer className="h-3 w-4/5 rounded" />
                  <Shimmer className="h-2.5 w-3/5 rounded" />
                </div>
              </div>
              <div className="flex items-stretch gap-2">
                <Shimmer className="aspect-square w-11 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <Shimmer className="h-2.5 w-2/3 rounded" />
                  <Shimmer className="h-2.5 w-1/2 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionSkeleton>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <SectionSkeleton title>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-slate-100 p-2.5 sm:p-3.5">
                <Shimmer className="h-7 w-7 rounded-lg sm:h-10 sm:w-10" />
                <Shimmer className="h-4 w-8 rounded" />
                <Shimmer className="h-2.5 w-14 rounded" />
              </div>
            ))}
          </div>
        </SectionSkeleton>

        <div className="rounded-xl border border-slate-100 bg-white p-3.5">
          <div className="flex items-center justify-between">
            <Shimmer className="h-4 w-24 rounded" />
            <Shimmer className="h-3 w-10 rounded" />
          </div>
          <div className="mt-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Shimmer className="h-6 w-6 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Shimmer className="h-3 w-3/4 rounded" />
                  <Shimmer className="h-2.5 w-1/2 rounded" />
                </div>
                <Shimmer className="h-3 w-8 shrink-0 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionSkeleton title>
        <div className="mt-2.5 flex gap-2.5 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[148px] shrink-0 overflow-hidden rounded-xl border border-slate-100">
              <Shimmer className="aspect-video w-full rounded-none" />
              <div className="flex flex-col items-center gap-1.5 px-2.5 py-3">
                <Shimmer className="h-3 w-4/5 rounded" />
                <Shimmer className="h-2.5 w-3/5 rounded" />
                <Shimmer className="h-2.5 w-3/5 rounded" />
                <Shimmer className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </SectionSkeleton>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Shimmer className="h-4 w-40 rounded" />
          <div className="mt-2.5 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 px-3.5 py-4">
                <Shimmer className="h-16 w-16 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Shimmer className="h-3.5 w-4/5 rounded" />
                  <Shimmer className="h-3 w-3/5 rounded" />
                  <Shimmer className="h-2.5 w-2/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-3">
          <div>
            <Shimmer className="h-4 w-40 rounded" />
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 rounded-lg border border-slate-100 p-2">
                  <Shimmer className="h-16 w-16 rounded-full" />
                  <Shimmer className="h-3 w-4/5 rounded" />
                  <Shimmer className="h-2.5 w-1/2 rounded" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Shimmer className="h-4 w-36 rounded" />
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex items-start gap-2.5">
                    <Shimmer className="h-12 w-12 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Shimmer className="h-3.5 w-4/5 rounded" />
                      <Shimmer className="h-3 w-1/3 rounded" />
                      <Shimmer className="h-2.5 w-full rounded" />
                    </div>
                  </div>
                  <Shimmer className="mt-2.5 h-7 w-full rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionSkeleton title={false}>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2.5">
              <Shimmer className="h-8 w-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3 w-4/5 rounded" />
                <Shimmer className="h-2.5 w-3/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </SectionSkeleton>
    </div>
  );
}

function SearchWalletRowSkeleton() {
  return (
    <div className="flex items-stretch gap-2">
      <Shimmer className="h-[42px] flex-[5] rounded-md md:flex-[9]" />
      <Shimmer className="h-[42px] flex-[2] rounded-md" />
    </div>
  );
}

function PromoCarouselSkeleton() {
  return (
    <div className="mt-3">
      <Shimmer className="w-full rounded-xl" style={{ height: "clamp(160px, 28cqw, 300px)" }} />
      <div className="flex items-center justify-center gap-1.5 pt-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-1.5 w-5 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

function WelcomeBannerSkeleton() {
  return (
    <div className="mt-4 w-full rounded-md border p-3.5" style={{ borderColor: "rgba(4,112,132,0.14)" }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        <div className="col-span-2 sm:col-span-4">
          <Shimmer className="h-4 w-56 rounded" />
          <Shimmer className="mt-2 h-3 w-40 rounded" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md border border-slate-100 p-2.5">
                <Shimmer className="h-6 w-6 rounded-lg" />
                <Shimmer className="mt-2 h-2.5 w-4/5 rounded" />
                <Shimmer className="mt-1.5 h-2.5 w-3/5 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-1 flex flex-row items-center justify-between gap-2 sm:flex-col">
          <Shimmer className="hidden h-16 w-20 rounded sm:block" />
          <Shimmer className="h-9 flex-1 rounded-md sm:w-full" />
        </div>
      </div>
    </div>
  );
}

function SectionSkeleton({ title, children }) {
  return (
    <div className="mt-5">
      {title && (
        <div className="flex items-center justify-between">
          <Shimmer className="h-4 w-48 rounded" />
          <Shimmer className="h-3 w-12 rounded" />
        </div>
      )}
      {children}
    </div>
  );
}

function Shimmer({ className = "", style }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/70 ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}