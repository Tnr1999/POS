"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/admin/menu", label: "จัดการเมนู" },
  { href: "/admin/stock", label: "คลังสินค้า" },
  { href: "/admin/tables", label: "โต๊ะ / QR" },
  { href: "/reports", label: "รายงาน" },
];

/** Desktop nav row — mobile uses BottomNavigation instead (see (staff)/layout.tsx). */
export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex items-center gap-1">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 inline-flex items-center px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
              active
                ? "bg-(--brand) text-(--brand-foreground)"
                : "text-(--text-subtle) hover:bg-(--surface-muted)"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
