import { Skeleton } from "@/components/Skeleton";

/** Mirrors the stat cards / chart / best-sellers / bills sections so the
 *  page shell (title + filter bar) never waits on the report query. */
export function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px] col-span-2 sm:col-span-1" />
      </div>

      <section className="card p-4 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full" />
      </section>

      <section className="card p-4 space-y-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </section>

      <section className="card p-4 space-y-3">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </section>
    </div>
  );
}
