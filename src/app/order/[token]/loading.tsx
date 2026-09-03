import { Skeleton } from "@/components/Skeleton";

export default function OrderLoading() {
  return (
    <div className="max-w-2xl mx-auto pb-32 px-4">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl mb-4" />
      <Skeleton className="h-12 w-full rounded-full mb-4" />
      <div className="flex gap-2 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
