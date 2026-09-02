import { logout } from "@/app/login/actions";
import { StaffNav } from "./StaffNav";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="no-print bg-(--surface) border-b border-(--surface-border) px-2 py-2 flex items-center gap-2">
        <StaffNav />
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
