import type { ReactNode } from "react";

/** Shared "label + big number" stat card — used on /admin/stock and /reports
 *  so the two pages' summary rows don't quietly drift into two different
 *  sizes/weights over time. */
export function StatCard({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: ReactNode;
  tone?: "brand" | "warning" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "brand"
      ? "text-(--brand-hover)"
      : tone === "warning"
        ? "text-(--text-warning)"
        : tone === "danger"
          ? "text-(--text-danger)"
          : "text-(--foreground)";

  return (
    <div className={`card p-4 ${className}`}>
      <p className="text-sm text-(--text-muted)">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
