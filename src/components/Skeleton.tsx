/** Warm, on-brand loading placeholder — cream/surface-muted blocks with a
 *  subtle pulse, used instead of a generic spinner wherever a page's data
 *  section is still loading. Never the primary loading affordance on its
 *  own; the page shell (header, nav, static controls) renders around it
 *  immediately. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-(--surface-muted) ${className}`} />;
}
