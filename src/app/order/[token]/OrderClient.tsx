"use client";

import { useEffect, useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";
import type { CartLine } from "./actions";

type MenuItem = { id: string; name: string; price: number };
type MenuGroup = { id: string; name: string; items: MenuItem[] };
type OrderItem = { id: string; name: string; price: number; qty: number; status: string };
type OrderState = { id: string; status: string; items: OrderItem[] } | null;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอครัวรับออเดอร์",
  PREPARING: "กำลังทำ",
  SERVED: "เสิร์ฟแล้ว",
  CANCELLED: "ยกเลิก",
};
// which pill style each status gets — see DESIGN.md "Status pill" component
const STATUS_CHIP: Record<string, string> = {
  PENDING: "chip",
  PREPARING: "chip",
  SERVED: "chip chip-success",
  CANCELLED: "chip chip-neutral",
};

export function OrderClient({
  token,
  tableName,
  menuGroups,
  initialOrder,
  placeOrder,
}: {
  token: string;
  tableName: string;
  menuGroups: MenuGroup[];
  initialOrder: OrderState;
  placeOrder: (token: string, cart: CartLine[]) => Promise<void>;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<OrderState>(initialOrder);
  const [isPending, startTransition] = useTransition();
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/tables/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setOrder(data.order);
      } catch {
        // ignore transient network errors while polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const cartLines: CartLine[] = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({ menuItemId, qty }));

  const allItems = menuGroups.flatMap((g) => g.items);
  const cartTotal = cartLines.reduce((sum, line) => {
    const item = allItems.find((i) => i.id === line.menuItemId);
    return sum + (item ? item.price * line.qty : 0);
  }, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  function setQty(itemId: string, qty: number) {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, Math.min(50, qty)) }));
  }

  function handleSubmit() {
    if (cartLines.length === 0) return;
    startTransition(async () => {
      await placeOrder(token, cartLines);
      setCart({});
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
    });
  }

  const openTotal = order?.items.reduce((sum, i) => sum + i.price * i.qty, 0) ?? 0;

  return (
    <div className="max-w-2xl mx-auto pb-32">
      <header className="card rounded-none px-4 py-3.5 sticky top-0 z-10 flex items-baseline gap-2.5">
        <h1 className="font-display text-2xl text-(--brand) leading-none">{tableName}</h1>
        <p className="text-sm text-(--text-muted)">สแกนเพื่อสั่งอาหาร</p>
      </header>

      {order && order.items.length > 0 && (
        <section className="mx-4 mt-4 card bg-(--chip-bg) p-4">
          <h2 className="font-semibold mb-2 text-(--chip-foreground)">ออเดอร์ของคุณ</h2>
          <ul className="space-y-2 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>
                  {item.name} <span className="text-(--text-muted)">x{item.qty}</span>
                </span>
                <span className={STATUS_CHIP[item.status] ?? "chip chip-neutral"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-right font-semibold mt-3 pt-2 border-t border-(--surface-border)">
            รวม {formatBaht(openTotal)} บาท
          </p>
        </section>
      )}

      {justSubmitted && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-green-100 text-green-700 text-center text-sm font-medium">
          ส่งออเดอร์แล้ว! ครัวกำลังเตรียมอาหารของคุณ
        </div>
      )}

      <main className="p-4 space-y-7">
        {menuGroups.map((group) => (
          <section key={group.id}>
            <h2 className="font-display text-xl text-(--brand) mb-3">{group.name}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.items.map((item) => {
                const qty = cart[item.id] ?? 0;
                return (
                  <li
                    key={item.id}
                    className={`card p-3 flex items-center justify-between gap-2 transition-shadow ${
                      qty > 0 ? "ring-2 ring-(--brand)" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-sm text-(--text-muted)">{formatBaht(item.price)} บาท</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setQty(item.id, qty - 1)}
                        disabled={qty === 0}
                        aria-label={`ลด ${item.name}`}
                        className="w-10 h-10 rounded-full bg-(--surface-muted) font-bold text-lg disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-medium tabular-nums">{qty}</span>
                      <button
                        onClick={() => setQty(item.id, qty + 1)}
                        aria-label={`เพิ่ม ${item.name}`}
                        className="w-10 h-10 rounded-full bg-(--brand) text-(--brand-foreground) font-bold text-lg"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {menuGroups.length === 0 && (
          <p className="text-center text-(--text-muted-2)">ยังไม่มีเมนูให้สั่ง</p>
        )}
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="max-w-2xl mx-auto p-4">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full bg-(--brand) text-(--brand-foreground) rounded-xl py-3.5 font-semibold flex justify-between px-5 shadow-[0_10px_30px_rgb(0_0_0_/_0.2)] disabled:opacity-50"
            >
              <span>สั่งอาหาร ({cartCount})</span>
              <span>{formatBaht(cartTotal)} บาท</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
