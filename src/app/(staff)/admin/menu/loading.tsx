import { Skeleton } from "@/components/Skeleton";

export default function MenuAdminLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-full sm:w-32" />
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="flex flex-col sm:flex-row gap-2">
        <Skeleton className="h-11 w-full sm:flex-1" />
        <Skeleton className="h-11 w-full sm:w-48" />
        <Skeleton className="h-11 w-full sm:w-40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}
