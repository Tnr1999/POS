import { Skeleton } from "@/components/Skeleton";

/** Mirrors the QR card grid so the header/add-table form never wait on the
 *  table query + QR rendering. */
export function TablesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="aspect-square w-full max-w-[240px] mx-auto" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
