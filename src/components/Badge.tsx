import type { ReactNode } from "react";

export type BadgeTone = "brand" | "success" | "warning" | "danger" | "gold" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  brand: "chip",
  success: "chip chip-success",
  warning: "chip chip-warning",
  danger: "chip chip-danger",
  gold: "chip chip-gold",
  neutral: "chip chip-neutral",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`${TONE_CLASSES[tone]} ${className}`}>{children}</span>;
}
