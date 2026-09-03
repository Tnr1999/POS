"use client";

import { HomeIcon, MenuBookIcon, ReceiptIcon, ChatIcon } from "@/components/icons";

export type CustomerTab = "home" | "menu" | "orders" | "contact";

const TABS: { id: CustomerTab; label: string; Icon: typeof HomeIcon }[] = [
  { id: "home", label: "หน้าแรก", Icon: HomeIcon },
  { id: "menu", label: "เมนู", Icon: MenuBookIcon },
  { id: "orders", label: "ออเดอร์", Icon: ReceiptIcon },
  { id: "contact", label: "ติดต่อร้าน", Icon: ChatIcon },
];

/**
 * Customer-facing bottom nav — deliberately distinct from the staff app's
 * BottomNavigation (this route has no login/admin chrome at all). Every
 * tab is a same-page action (scroll or open a sheet), not a route change —
 * this is a single-page ordering experience, not a multi-route app.
 */
export function CustomerBottomNav({
  active,
  onSelect,
}: {
  active: CustomerTab | null;
  onSelect: (tab: CustomerTab) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-(--surface) border-t border-(--surface-border) flex max-w-2xl mx-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem] text-xs font-medium transition-colors ${
            active === id ? "text-(--cta)" : "text-(--text-muted-2)"
          }`}
        >
          <Icon className="w-5 h-5" />
          {label}
        </button>
      ))}
    </nav>
  );
}
