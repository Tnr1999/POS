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
    <div className="max-w-2xl mx-auto pb-28">
      <header className="p-4 bg-(--surface) border-b sticky top-0 z-10">
        <h1 className="text-lg font-bold">{tableName}</h1>
        <p className="text-sm text-(--text-muted)">สแกนเพื่อสั่งอาหาร</p>
      </header>

      {order && order.items.length > 0 && (
        <section className="p-4 bg-amber-50 border-b">
          <h2 className="font-semibold mb-2">ออเดอร์ของคุณ</h2>
          <ul className="space-y-1 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.name} x{item.qty}
                </span>
                <span className="text-(--text-muted)">
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-right font-medium mt-2">
            รวม {formatBaht(openTotal)} บาท
          </p>
        </section>
      )}

      {justSubmitted && (
        <div className="p-3 bg-green-100 text-green-700 text-center text-sm">
          ส่งออเดอร์แล้ว! ครัวกำลังเตรียมอาหารของคุณ
        </div>
      )}

      <main className="p-4 space-y-6">
        {menuGroups.map((group) => (
          <section key={group.id}>
            <h2 className="font-semibold mb-2">{group.name}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((item) => (
                <li
                  key={item.id}
                  className="bg-(--surface) rounded-xl shadow-sm p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-(--text-muted)">{formatBaht(item.price)} บาท</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setQty(item.id, (cart[item.id] ?? 0) - 1)}
                      className="w-10 h-10 rounded-full bg-(--surface-muted) font-bold text-lg"
                    >
                      -
                    </button>
                    <span className="w-6 text-center">{cart[item.id] ?? 0}</span>
                    <button
                      onClick={() => setQty(item.id, (cart[item.id] ?? 0) + 1)}
                      className="w-10 h-10 rounded-full bg-(--surface-muted) font-bold text-lg"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {menuGroups.length === 0 && (
          <p className="text-center text-(--text-muted-2)">ยังไม่มีเมนูให้สั่ง</p>
        )}
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-(--surface) border-t p-4 max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-(--brand) text-(--brand-foreground) rounded-xl py-3 font-semibold flex justify-between px-4 disabled:opacity-50"
          >
            <span>สั่งอาหาร ({cartCount})</span>
            <span>{formatBaht(cartTotal)} บาท</span>
          </button>
        </div>
      )}
    </div>
  );
}
