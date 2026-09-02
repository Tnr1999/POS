"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/admin/menu", label: "จัดการเมนู" },
  { href: "/admin/stock", label: "คลังสินค้า" },
  { href: "/admin/tables", label: "จัดการโต๊ะ / QR" },
  { href: "/reports", label: "รายงานยอดขาย" },
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none"
      style={{
        // fades the edges so a scrollable-but-clipped nav doesn't look like
        // it just got cut off mid-label at the screen edge
        maskImage: "linear-gradient(to right, transparent, black 12px, black calc(100% - 20px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 12px, black calc(100% - 20px), transparent)",
      }}
    >
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-(--brand) text-(--brand-foreground)"
                : "hover:bg-(--surface-muted)"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
