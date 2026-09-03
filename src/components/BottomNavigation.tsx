"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsIcon, MenuBookIcon, BoxIcon, QrIcon, ChartIcon } from "./icons";

const NAV_ITEMS = [
  { href: "/pos", label: "หน้าขาย", Icon: UtensilsIcon },
  { href: "/admin/menu", label: "เมนู", Icon: MenuBookIcon },
  { href: "/admin/stock", label: "คลังสินค้า", Icon: BoxIcon },
  { href: "/admin/tables", label: "โต๊ะ/QR", Icon: QrIcon },
  { href: "/reports", label: "รายงาน", Icon: ChartIcon },
];

/**
 * Fixed bottom tab bar for mobile only (`sm:hidden`) — the desktop/top nav
 * lives in `StaffNav`. Content pages add bottom padding
 * (`pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-4`) so this never
 * clips the last card on a long page.
 */
export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className="no-print sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-(--surface) border-t border-(--surface-border) flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem] text-xs font-medium ${
              active ? "text-(--brand)" : "text-(--text-muted-2)"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
