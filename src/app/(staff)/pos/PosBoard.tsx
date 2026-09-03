"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";
import { ConfirmButton } from "@/components/ConfirmButton";
import { toast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { Select } from "@/components/Select";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

const NEW_ORDER_HIGHLIGHT_MS = 15000;

/** Two short beeps via Web Audio — no external asset needed. Browsers block
 *  audio until a user gesture, so the context is created lazily on the
 *  first click/tap anywhere on the page (see useNewOrderAlert below). */
function playNewOrderBeep(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.22].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.2, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

/** Tracks which order ids are "new since last poll" so the board can ring +
 *  highlight them, without needing a real push/websocket channel. */
function useNewOrderAlert(orders: Order[]) {
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    function unlockAudio() {
      audioCtx.current ??= new AudioContext();
    }
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  useEffect(() => {
    const currentIds = new Set(orders.map((o) => o.id));
    if (knownIds.current === null) {
      // first render — nothing "new" yet, just record the baseline
      knownIds.current = currentIds;
      return;
    }
    const arrived = orders.filter((o) => !knownIds.current!.has(o.id));
    knownIds.current = currentIds;
    if (arrived.length === 0) return;

    if (audioCtx.current) playNewOrderBeep(audioCtx.current);
    toast(
      arrived.length === 1
        ? `ออเดอร์ใหม่: ${arrived[0].tableName ?? (arrived[0].type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}`
        : `มีออเดอร์ใหม่ ${arrived.length} ออเดอร์`
    );
    setNewIds((prev) => new Set([...prev, ...arrived.map((o) => o.id)]));
    arrived.forEach((o) => {
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          next.delete(o.id);
          return next;
        });
      }, NEW_ORDER_HIGHLIGHT_MS);
    });
  }, [orders]);

  return newIds;
}

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
  const newOrderIds = useNewOrderAlert(orders);

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
      try {
        await advanceOrderItemStatus(orderItemId);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ", "error");
      }
    });
  }

  function handlePay(orderId: string) {
    startTransition(async () => {
      try {
        await payOrder(orderId);
        router.push(`/receipt/${orderId}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "ชำระเงินไม่สำเร็จ", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
          const isNew = newOrderIds.has(order.id);
          return (
            <div
              key={order.id}
              className={`card p-4 space-y-3 transition-shadow ${
                isNew ? "ring-2 ring-amber-500 animate-pulse" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="card-title flex items-center gap-2">
                  {order.tableName ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
                  {isNew && <Badge tone="warning">ใหม่</Badge>}
                </h2>
                <span className="text-xs text-(--text-muted-2)">
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
                      <span className="text-(--text-success) text-xs shrink-0">เสิร์ฟแล้ว</span>
                    ) : (
                      <button
                        disabled={isPending}
                        onClick={() => handleAdvance(item.id)}
                        className="text-xs bg-(--surface-muted) rounded-full px-3 py-2 shrink-0 disabled:opacity-50"
                      >
                        {ITEM_STATUS_LABEL[item.status]} → {NEXT_STATUS_LABEL[item.status]}
                      </button>
                    )}
                  </li>
                ))}
                {order.items.length === 0 && (
                  <li className="text-(--text-muted-2)">ยังไม่มีรายการ</li>
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
                  <ConfirmButton
                    action={() => cancelOrder(order.id)}
                    confirmTitle="ยกเลิกออเดอร์"
                    confirmMessage={`ยกเลิกออเดอร์ของ${order.tableName ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}? ลบแล้วกู้คืนไม่ได้`}
                    confirmLabel="ยกเลิกออเดอร์"
                    className="text-sm text-(--text-danger) disabled:opacity-50 px-2"
                    onSuccess={() => router.refresh()}
                  >
                    ยกเลิก
                  </ConfirmButton>
                  <Button
                    variant="cta"
                    size="sm"
                    onClick={() => handlePay(order.id)}
                    disabled={isPending || order.items.length === 0}
                    className="flex-1"
                  >
                    ชำระเงิน / พิมพ์บิล
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {orders.length === 0 && (
        <EmptyState
          title="ยังไม่มีออเดอร์ที่เปิดอยู่"
          description="ออเดอร์จากลูกค้าที่สแกน QR หรือที่พนักงานสร้างเองจะขึ้นที่นี่"
        />
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
      <Select
        value={menuItemId}
        onChange={(e) => setMenuItemId(e.target.value)}
        className="flex-1 min-w-[140px] py-2"
      >
        {menuItems.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {m.trackStock && m.stock <= 5 ? ` (เหลือ ${m.stock})` : ""}
          </option>
        ))}
      </Select>
      <Input
        type="number"
        min={1}
        max={50}
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        className="w-16 py-2"
      />
      <Button
        variant="accent"
        size="sm"
        disabled={isPending || !menuItemId}
        onClick={() =>
          startTransition(async () => {
            try {
              await addItemToOrder(orderId, menuItemId, qty);
              setQty(1);
              onAdded();
            } catch (err) {
              toast(err instanceof Error ? err.message : "เพิ่มรายการไม่สำเร็จ", "error");
            }
          })
        }
      >
        เพิ่ม
      </Button>
    </div>
  );
}
