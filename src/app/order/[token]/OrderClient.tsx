"use client";

import { useEffect, useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";
import type { CartLine } from "./actions";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  trackStock: boolean;
  stock: number;
};
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
  placeOrder: (token: string, cart: CartLine[]) => Promise<{ unavailable: string[] }>;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<OrderState>(initialOrder);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/public/tables/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setOrder(data.order);
        if (data.stock) setStockLevels(data.stock);
      } catch {
        // ignore transient network errors while polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  function stockOf(item: MenuItem): number {
    return stockLevels[item.id] ?? item.stock;
  }
  function isSoldOut(item: MenuItem): boolean {
    return item.trackStock && stockOf(item) <= 0;
  }
  function maxQtyOf(item: MenuItem): number {
    return item.trackStock ? Math.max(0, stockOf(item)) : 50;
  }

  const cartLines: CartLine[] = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({ menuItemId, qty }));

  const allItems = menuGroups.flatMap((g) => g.items);
  const cartTotal = cartLines.reduce((sum, line) => {
    const item = allItems.find((i) => i.id === line.menuItemId);
    return sum + (item ? item.price * line.qty : 0);
  }, 0);
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);

  function setQty(item: MenuItem, qty: number) {
    const clamped = Math.max(0, Math.min(maxQtyOf(item), qty));
    setCart((prev) => ({ ...prev, [item.id]: clamped }));
  }

  function handleSubmit() {
    if (cartLines.length === 0) return;
    startTransition(async () => {
      const result = await placeOrder(token, cartLines);
      setCart({});
      if (result.unavailable.length > 0) {
        setUnavailable(result.unavailable);
        setTimeout(() => setUnavailable([]), 5000);
      } else {
        setJustSubmitted(true);
        setTimeout(() => setJustSubmitted(false), 3000);
      }
    });
  }

  const openTotal = order?.items.reduce((sum, i) => sum + i.price * i.qty, 0) ?? 0;

  return (
    <div className="max-w-2xl mx-auto pb-28">
      <header className="p-4 bg-white border-b sticky top-0 z-10">
        <h1 className="text-lg font-bold">{tableName}</h1>
        <p className="text-sm text-gray-500">สแกนเพื่อสั่งอาหาร</p>
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
                <span className="text-gray-500">
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

      {unavailable.length > 0 && (
        <div className="p-3 bg-red-100 text-red-700 text-center text-sm">
          ขออภัย {unavailable.join(", ")} หมดพอดี รายการนี้ไม่ถูกเพิ่มในออเดอร์
          (รายการอื่นในตะกร้าสั่งสำเร็จแล้ว)
        </div>
      )}

      <main className="p-4 space-y-6">
        {menuGroups.map((group) => (
          <section key={group.id}>
            <h2 className="font-semibold mb-2">{group.name}</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.items.map((item) => {
                const soldOut = isSoldOut(item);
                const qty = cart[item.id] ?? 0;
                const atMax = item.trackStock && qty >= maxQtyOf(item);
                return (
                  <li
                    key={item.id}
                    className={`bg-white rounded-xl shadow-sm p-3 flex items-center justify-between gap-2 ${
                      soldOut ? "opacity-50" : ""
                    }`}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatBaht(item.price)} บาท
                      </p>
                      {soldOut && (
                        <p className="text-xs text-red-600 font-medium">หมด</p>
                      )}
                    </div>
                    {!soldOut && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setQty(item, qty - 1)}
                          className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg"
                        >
                          -
                        </button>
                        <span className="w-6 text-center">{qty}</span>
                        <button
                          onClick={() => setQty(item, qty + 1)}
                          disabled={atMax}
                          className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {menuGroups.length === 0 && (
          <p className="text-center text-gray-400">ยังไม่มีเมนูให้สั่ง</p>
        )}
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full bg-black text-white rounded-xl py-3 font-semibold flex justify-between px-4 disabled:opacity-50"
          >
            <span>สั่งอาหาร ({cartCount})</span>
            <span>{formatBaht(cartTotal)} บาท</span>
          </button>
        </div>
      )}
    </div>
  );
}
