import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "cta" | "accent" | "ghost" | "danger" | "warning";
export type ButtonSize = "md" | "sm";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Default primary — most staff actions (บันทึก, เพิ่ม, เข้าสู่ระบบ).
  primary: "bg-(--brand) text-(--brand-foreground) hover:bg-(--brand-hover)",
  // Reserved for the one or two highest-stakes actions per screen
  // (สั่งอาหาร, ชำระเงิน) — see DESIGN.md, don't use for ordinary buttons.
  cta: "bg-(--cta) text-(--cta-foreground) hover:bg-(--cta-hover)",
  // Secondary — "print", "add item", "save" — one step down from whichever
  // of the above is primary on that screen.
  accent: "bg-(--accent) text-(--accent-foreground) hover:bg-(--accent-hover)",
  ghost: "bg-(--surface) text-(--foreground) border border-(--surface-border) hover:bg-(--surface-muted)",
  danger: "bg-red-600 text-white hover:bg-red-700",
  warning: "bg-amber-600 text-white hover:bg-amber-700",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: "px-4 py-2.5 text-sm rounded-lg",
  sm: "px-3 py-2 text-sm rounded-lg",
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps & { href: string; target?: string };

function classesFor({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className">) {
  return [
    "inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Shared button — replaces the repeated `className="bg-(--brand) ..."`
 * strings across every page. Renders a real `<Link>` when `href` is given
 * (for nav-styled-as-button cases like "+ ออเดอร์ใหม่"), otherwise a real
 * `<button>`. Never a `<div onClick>`.
 */
export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant, size, fullWidth, className, children } = props;
  const classes = classesFor({ variant, size, fullWidth, className });

  if ("href" in props && props.href !== undefined) {
    return (
      <Link href={props.href} target={props.target} className={classes}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping non-DOM props before spreading
  const { variant: _v, size: _s, fullWidth: _fw, className: _c, children: _ch, href: _href, ...nativeProps } =
    props as ButtonAsButton;
  return (
    <button {...nativeProps} className={classes}>
      {children}
    </button>
  );
}
