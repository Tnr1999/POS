"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBaht } from "@/lib/money";
import { stockStatusOf } from "@/lib/stockStatus";
import { Button } from "@/components/Button";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState } from "@/components/EmptyState";
import { MenuItemImage } from "@/components/MenuItemImage";
import { toast } from "@/components/Toast";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  trackStock: boolean;
  stock: number;
};
type MenuGroup = { id: string; name: string; items: MenuItem[] };

const ALL_GROUP_ID = "__all__";

export function NewOrderClient({
  menuGroups,
  createWalkInOrder,
}: {
  menuGroups: MenuGroup[];
  createWalkInOrder: (
    type: "DINE_IN" | "TAKEAWAY",
    lines: { menuItemId: string; qty: number }[]
  ) => Promise<{ orderId: string | null; unavailable: string[] }>;
}) {
  const [type, setType] = useState<"DINE_IN" | "TAKEAWAY">("TAKEAWAY");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [activeGroupId, setActiveGroupId] = useState(ALL_GROUP_ID);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const allItems = useMemo(() => menuGroups.flatMap((g) => g.items), [menuGroups]);

  const visibleItems = useMemo(() => {
    const base = activeGroupId === ALL_GROUP_ID
      ? allItems
      : menuGroups.find((g) => g.id === activeGroupId)?.items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeGroupId, allItems, menuGroups, query]);

  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({ menuItemId, qty }));
  const total = lines.reduce((sum, l) => {
    const item = allItems.find((i) => i.id === l.menuItemId);
    return sum + (item ? item.price * l.qty : 0);
  }, 0);
  const cartCount = lines.reduce((sum, l) => sum + l.qty, 0);

  function maxQtyOf(item: MenuItem): number {
    return item.trackStock ? Math.max(0, item.stock) : 50;
  }
  function isSoldOut(item: MenuItem): boolean {
    return stockStatusOf(item) === "out";
  }

  function setQty(item: MenuItem, qty: number) {
    setCart((prev) => ({ ...prev, [item.id]: Math.max(0, Math.min(maxQtyOf(item), qty)) }));
  }

  function handleCreate() {
    if (lines.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await createWalkInOrder(type, lines);
        if (result.unavailable.length > 0) {
          setError(`${result.unavailable.join(", ")} มีสต็อกไม่พอ ไม่ได้เพิ่มในออเดอร์`);
        }
        if (result.orderId) router.push("/pos");
      } catch (err) {
        toast(err instanceof Error ? err.message : "สร้างออเดอร์ไม่สำเร็จ กรุณาลองใหม่", "error");
      }
    });
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-4 lg:pb-4 ${cartCount > 0 ? "pb-44" : "pb-4"}`}>
      <h1 className="page-title">ออเดอร์ใหม่</h1>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-(--text-danger) text-center text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[10rem_1fr_20rem] gap-4 items-start">
        {/* Category rail — vertical list on desktop, horizontal scroll on mobile */}
        <div className="lg:sticky lg:top-4 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0">
          <CategoryButton
            active={activeGroupId === ALL_GROUP_ID}
            onClick={() => setActiveGroupId(ALL_GROUP_ID)}
          >
            ทั้งหมด
          </CategoryButton>
          {menuGroups.map((group) => (
            <CategoryButton
              key={group.id}
              active={activeGroupId === group.id}
              onClick={() => setActiveGroupId(group.id)}
            >
              {group.name}
            </CategoryButton>
          ))}
        </div>

        {/* Menu grid */}
        <div className="space-y-3 min-w-0">
          <SearchInput
            placeholder="ค้นหาเมนู..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {visibleItems.length === 0 ? (
            <EmptyState title="ไม่พบเมนู" description="ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visibleItems.map((item) => {
                const soldOut = isSoldOut(item);
                const qty = cart[item.id] ?? 0;
                return (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    qty={qty}
                    soldOut={soldOut}
                    atMax={item.trackStock && qty >= maxQtyOf(item)}
                    onDecrement={() => setQty(item, qty - 1)}
                    onIncrement={() => setQty(item, qty + 1)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Cart panel — sticky right column on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-4">
          <CartPanel
            type={type}
            setType={setType}
            lines={lines}
            allItems={allItems}
            total={total}
            isPending={isPending}
            onSubmit={handleCreate}
          />
        </div>
      </div>

      {/* Mobile: type toggle + floating submit bar */}
      <div className="lg:hidden flex gap-2">
        <TypeToggle type={type} setType={setType} />
      </div>

      {cartCount > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 px-4">
          <div className="max-w-6xl mx-auto">
            <Button
              variant="cta"
              fullWidth
              onClick={handleCreate}
              disabled={isPending}
              className="py-3.5 rounded-xl shadow-[0_10px_30px_rgb(0_0_0_/_0.2)] flex justify-between px-5"
            >
              <span>สร้างออเดอร์ ({cartCount})</span>
              <span>{formatBaht(total)} บาท</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-left px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? "bg-(--brand) text-(--brand-foreground) border-(--brand)"
          : "bg-(--surface) border-(--surface-border) hover:bg-(--surface-muted)"
      }`}
    >
      {children}
    </button>
  );
}

function MenuItemCard({
  item,
  qty,
  soldOut,
  atMax,
  onDecrement,
  onIncrement,
}: {
  item: MenuItem;
  qty: number;
  soldOut: boolean;
  atMax: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div
      className={`card overflow-hidden flex flex-col transition-shadow ${
        qty > 0 ? "ring-2 ring-(--brand)" : ""
      } ${soldOut ? "opacity-50" : ""}`}
    >
      <MenuItemImage src={item.imageUrl}>
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-semibold">
            หมด
          </span>
        )}
      </MenuItemImage>
      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <p className="card-title leading-snug line-clamp-2 min-h-[2.5em]">{item.name}</p>
        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="text-sm font-semibold text-(--foreground)">{formatBaht(item.price)}</span>
          {!soldOut &&
            (qty === 0 ? (
              <button
                onClick={onIncrement}
                aria-label={`เพิ่ม ${item.name}`}
                className="w-11 h-11 min-h-0 rounded-full bg-(--brand) text-(--brand-foreground) flex items-center justify-center font-bold text-lg leading-none"
              >
                +
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onDecrement}
                  aria-label={`ลด ${item.name}`}
                  className="w-11 h-11 min-h-0 rounded-full bg-(--surface-muted) flex items-center justify-center font-bold leading-none"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button
                  onClick={onIncrement}
                  disabled={atMax}
                  aria-label={`เพิ่ม ${item.name}`}
                  className="w-11 h-11 min-h-0 rounded-full bg-(--brand) text-(--brand-foreground) flex items-center justify-center font-bold leading-none disabled:opacity-40"
                >
                  +
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function TypeToggle({
  type,
  setType,
}: {
  type: "DINE_IN" | "TAKEAWAY";
  setType: (t: "DINE_IN" | "TAKEAWAY") => void;
}) {
  return (
    <div className="flex gap-2 flex-1">
      <button
        onClick={() => setType("TAKEAWAY")}
        className={`flex-1 rounded-lg py-2 text-sm font-medium ${
          type === "TAKEAWAY" ? "bg-(--brand) text-(--brand-foreground)" : "bg-(--surface) border border-(--surface-border)"
        }`}
      >
        กลับบ้าน
      </button>
      <button
        onClick={() => setType("DINE_IN")}
        className={`flex-1 rounded-lg py-2 text-sm font-medium ${
          type === "DINE_IN" ? "bg-(--brand) text-(--brand-foreground)" : "bg-(--surface) border border-(--surface-border)"
        }`}
      >
        นั่งทานที่ร้าน
      </button>
    </div>
  );
}

function CartPanel({
  type,
  setType,
  lines,
  allItems,
  total,
  isPending,
  onSubmit,
}: {
  type: "DINE_IN" | "TAKEAWAY";
  setType: (t: "DINE_IN" | "TAKEAWAY") => void;
  lines: { menuItemId: string; qty: number }[];
  allItems: MenuItem[];
  total: number;
  isPending: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="card p-4 space-y-3">
      <h2 className="section-title">ออเดอร์นี้</h2>
      <TypeToggle type={type} setType={setType} />
      <div className="border-t border-(--surface-border) pt-3 space-y-2 max-h-64 overflow-y-auto">
        {lines.length === 0 && (
          <p className="text-sm text-(--text-muted-2)">ยังไม่มีรายการ — แตะเมนูเพื่อเพิ่ม</p>
        )}
        {lines.map((line) => {
          const item = allItems.find((i) => i.id === line.menuItemId);
          if (!item) return null;
          return (
            <div key={line.menuItemId} className="flex justify-between text-sm gap-2">
              <span className="truncate">
                {item.name} <span className="text-(--text-muted)">x{line.qty}</span>
              </span>
              <span className="shrink-0 font-medium">{formatBaht(item.price * line.qty)}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-(--surface-border) pt-3 flex justify-between font-semibold">
        <span>รวม</span>
        <span>{formatBaht(total)} บาท</span>
      </div>
      <Button variant="cta" fullWidth disabled={isPending || lines.length === 0} onClick={onSubmit}>
        สร้างออเดอร์
      </Button>
    </div>
  );
}
