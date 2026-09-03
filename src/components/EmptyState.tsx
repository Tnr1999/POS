import type { ReactNode } from "react";

/** Default "empty plate" line illustration — subtle, not decorative artwork. */
function EmptyPlateIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <circle cx="48" cy="48" r="34" stroke="var(--surface-border)" strokeWidth="3" />
      <circle cx="48" cy="48" r="20" stroke="var(--surface-border)" strokeWidth="3" />
      <path
        d="M30 30 22 22M66 30l8-8M30 66l-8 8"
        stroke="var(--surface-border)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center py-10 px-4 gap-3 ${className}`}>
      {icon ?? <EmptyPlateIllustration className="w-16 h-16" />}
      <div className="space-y-1">
        <p className="font-medium text-(--text-subtle)">{title}</p>
        {description && (
          <p className="text-sm text-(--text-muted-2) max-w-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
