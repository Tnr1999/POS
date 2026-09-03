import { Skeleton } from "@/components/Skeleton";

/** Mirrors PosBoard's order-card grid shape so the shell never jumps once
 *  real data arrives. */
export function PosBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
          <Skeleton className="h-9 w-full" />
          <div className="flex items-center justify-between pt-2 border-t border-(--surface-border)">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
