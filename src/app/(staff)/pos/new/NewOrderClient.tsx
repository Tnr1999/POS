"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";

type MenuItem = { id: string; name: string; price: number };
type MenuGroup = { id: string; name: string; items: MenuItem[] };

export function NewOrderClient({
  menuGroups,
  createWalkInOrder,
}: {
  menuGroups: MenuGroup[];
  createWalkInOrder: (
    type: "DINE_IN" | "TAKEAWAY",
    lines: { menuItemId: string; qty: number }[]
  ) => Promise<string | null>;
}) {
  const [type, setType] = useState<"DINE_IN" | "TAKEAWAY">("TAKEAWAY");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const allItems = menuGroups.flatMap((g) => g.items);
  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({ menuItemId, qty }));
  const total = lines.reduce((sum, l) => {
    const item = allItems.find((i) => i.id === l.menuItemId);
    return sum + (item ? item.price * l.qty : 0);
  }, 0);

  function setQty(itemId: string, qty: number) {
    setCart((prev) => ({ ...prev, [itemId]: Math.max(0, Math.min(50, qty)) }));
  }

  function handleCreate() {
    if (lines.length === 0) return;
    startTransition(async () => {
      const orderId = await createWalkInOrder(type, lines);
      if (orderId) router.push("/pos");
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-28">
      <h1 className="text-2xl font-bold">ออเดอร์ใหม่</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setType("TAKEAWAY")}
          className={`flex-1 rounded-lg py-2 font-medium ${
            type === "TAKEAWAY" ? "bg-black text-white" : "bg-white border"
          }`}
        >
          กลับบ้าน
        </button>
        <button
          onClick={() => setType("DINE_IN")}
          className={`flex-1 rounded-lg py-2 font-medium ${
            type === "DINE_IN" ? "bg-black text-white" : "bg-white border"
          }`}
        >
          นั่งทานที่ร้าน (ไม่ผ่าน QR)
        </button>
      </div>

      {menuGroups.map((group) => (
        <section key={group.id}>
          <h2 className="font-semibold mb-2">{group.name}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.items.map((item) => (
              <li
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-gray-500">{formatBaht(item.price)} บาท</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setQty(item.id, (cart[item.id] ?? 0) - 1)}
                    className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg"
                  >
                    -
                  </button>
                  <span className="w-6 text-center">{cart[item.id] ?? 0}</span>
                  <button
                    onClick={() => setQty(item.id, (cart[item.id] ?? 0) + 1)}
                    className="w-10 h-10 rounded-full bg-gray-100 font-bold text-lg"
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {lines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 max-w-2xl mx-auto">
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="w-full bg-black text-white rounded-xl py-3 font-semibold flex justify-between px-4 disabled:opacity-50"
          >
            <span>สร้างออเดอร์</span>
            <span>{formatBaht(total)} บาท</span>
          </button>
        </div>
      )}
    </div>
  );
}
