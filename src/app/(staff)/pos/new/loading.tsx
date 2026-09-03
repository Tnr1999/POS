import { Skeleton } from "@/components/Skeleton";

export default function NewOrderLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-1 lg:grid-cols-[10rem_1fr_20rem] gap-4 items-start">
        <div className="flex lg:flex-col gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 lg:w-full shrink-0" />
          ))}
        </div>
        <div className="space-y-3 min-w-0">
          <Skeleton className="h-11 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden lg:block h-72 w-full" />
      </div>
    </div>
  );
}
