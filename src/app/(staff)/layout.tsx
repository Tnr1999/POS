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
      <header className="no-print bg-white border-b px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <nav className="flex flex-wrap gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            ออกจากระบบ
          </button>
        </form>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
