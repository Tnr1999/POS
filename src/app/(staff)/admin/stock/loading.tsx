import { Skeleton } from "@/components/Skeleton";

export default function StockLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Skeleton className="h-[72px] col-span-2 sm:col-span-1" />
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px]" />
      </div>
      <div className="card p-4 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="card p-4 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
