"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";

type OrderItem = { id: string; name: string; price: number; qty: number; status: string };
type Order = {
  id: string;
  type: string;
  tableName: string | null;
  createdAt: string;
  items: OrderItem[];
};
type MenuItem = { id: string; name: string; price: number; trackStock: boolean; stock: number };

const ITEM_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอทำ",
  PREPARING: "กำลังทำ",
  SERVED: "เสิร์ฟแล้ว",
};
const NEXT_STATUS_LABEL: Record<string, string> = {
  PENDING: "เริ่มทำ",
  PREPARING: "เสิร์ฟแล้ว",
};

export function PosBoard({
  initialOrders,
  menuItems,
  advanceOrderItemStatus,
  addItemToOrder,
  payOrder,
  cancelOrder,
}: {
  initialOrders: Order[];
  menuItems: MenuItem[];
  advanceOrderItemStatus: (orderItemId: string) => Promise<void>;
  addItemToOrder: (orderId: string, menuItemId: string, qty: number) => Promise<void>;
  payOrder: (orderId: string) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/staff/orders/active", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setOrders(data.orders);
      } catch {
        // ignore transient network errors while polling
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleAdvance(orderItemId: string) {
    startTransition(async () => {
      await advanceOrderItemStatus(orderItemId);
      router.refresh();
    });
  }

  function handlePay(orderId: string) {
    startTransition(async () => {
      await payOrder(orderId);
      router.push(`/receipt/${orderId}`);
    });
  }

  function handleCancel(orderId: string) {
    if (!confirm("ยกเลิกออเดอร์นี้?")) return;
    startTransition(async () => {
      await cancelOrder(orderId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">ออเดอร์ที่เปิดอยู่</h1>
        <Link
          href="/pos/new"
          className="bg-black text-white rounded-lg px-4 py-2.5 text-sm font-medium text-center"
        >
          + ออเดอร์ใหม่ (หน้าร้าน/กลับบ้าน)
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
          return (
            <div key={order.id} className="bg-white rounded-xl shadow p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {order.tableName ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
                </h2>
                <span className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <ul className="space-y-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>
                      {item.name} x{item.qty}
                    </span>
                    {item.status === "SERVED" ? (
                      <span className="text-green-600 text-xs shrink-0">เสิร์ฟแล้ว</span>
                    ) : (
                      <button
                        disabled={isPending}
                        onClick={() => handleAdvance(item.id)}
                        className="text-xs bg-gray-100 rounded-full px-3 py-2 shrink-0 disabled:opacity-50"
                      >
                        {ITEM_STATUS_LABEL[item.status]} → {NEXT_STATUS_LABEL[item.status]}
                      </button>
                    )}
                  </li>
                ))}
                {order.items.length === 0 && (
                  <li className="text-gray-400">ยังไม่มีรายการ</li>
                )}
              </ul>

              <AddItemPicker
                orderId={order.id}
                menuItems={menuItems}
                addItemToOrder={addItemToOrder}
                onAdded={() => router.refresh()}
              />

              <div className="flex flex-col gap-2 pt-2 border-t">
                <span className="font-semibold">รวม {formatBaht(total)} บาท</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={isPending}
                    className="text-sm text-red-600 disabled:opacity-50 px-2"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handlePay(order.id)}
                    disabled={isPending || order.items.length === 0}
                    className="flex-1 bg-black text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    ชำระเงิน / พิมพ์บิล
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <p className="text-gray-400 text-center py-8">ยังไม่มีออเดอร์ที่เปิดอยู่</p>
      )}
    </div>
  );
}

function AddItemPicker({
  orderId,
  menuItems,
  addItemToOrder,
  onAdded,
}: {
  orderId: string;
  menuItems: MenuItem[];
  addItemToOrder: (orderId: string, menuItemId: string, qty: number) => Promise<void>;
  onAdded: () => void;
}) {
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [isPending, startTransition] = useTransition();

  if (menuItems.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        value={menuItemId}
        onChange={(e) => setMenuItemId(e.target.value)}
        className="border rounded-lg px-2 py-2 flex-1 min-w-[140px]"
      >
        {menuItems.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.trackStock && m.stock <= 5 ? ` (เหลือ ${m.stock})` : ""}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={50}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        className="border rounded-lg px-2 py-2 w-16"
      />
      <button
        disabled={isPending || !menuItemId}
        onClick={() =>
          startTransition(async () => {
            await addItemToOrder(orderId, menuItemId, qty);
            setQty(1);
            onAdded();
          })
        }
        className="bg-gray-800 text-white rounded-lg px-4 py-2 disabled:opacity-50"
      >
        เพิ่ม
      </button>
    </div>
  );
}
