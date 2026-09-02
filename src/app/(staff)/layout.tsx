import Link from "next/link";
import { logout } from "@/app/login/actions";

const NAV_LINKS = [
  { href: "/pos", label: "หน้าขาย" },
  { href: "/admin/menu", label: "จัดการเมนู" },
  { href: "/admin/tables", label: "จัดการโต๊ะ / QR" },
  { href: "/reports", label: "รายงานยอดขาย" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="no-print bg-(--surface) border-b border-(--surface-border) px-2 py-2 flex items-center gap-2">
        <nav className="flex-1 flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium hover:bg-(--surface-muted)"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium text-(--text-danger) hover:bg-(--surface-muted)"
          >
            ออกจากระบบ
          </button>
        </form>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
