import Link from "next/link";
import { logout } from "@/app/login/actions";
import { StaffNav } from "./StaffNav";
import { BottomNavigation } from "@/components/BottomNavigation";
import { DishMarkIcon } from "@/components/icons";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="no-print bg-(--surface) border-b border-(--surface-border) px-3 sm:px-4 py-2.5 flex items-center gap-3">
        <Link href="/pos" className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-full bg-(--brand) text-(--brand-foreground) flex items-center justify-center shrink-0">
            <DishMarkIcon className="w-5 h-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display font-semibold text-(--foreground) text-base">
              บ้านอร่อย
            </span>
            <span className="hidden sm:block text-xs text-(--text-muted-2)">ระบบจัดการร้าน</span>
          </span>
        </Link>

        <div className="flex-1 flex justify-center">
          <StaffNav />
        </div>

        <form action={logout} className="shrink-0">
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-sm font-medium text-(--text-danger) hover:bg-(--surface-muted)"
          >
            ออกจากระบบ
          </button>
        </form>
      </header>
      <main className="flex-1 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-4">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
}
