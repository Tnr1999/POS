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
import { CheckoutModal } from "./CheckoutModal";
import type { PayOrderOptions } from "./actions";

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

/** True once every item on the order has been served — the order needs no
 *  more kitchen action and is just waiting to be paid, distinct from an
 *  order still being cooked. Derived entirely from OrderItem.status (already
 *  fetched for the item list below), not a new state. */
function isReadyForPayment(items: OrderItem[]): boolean {
  return items.length > 0 && items.every((i) => i.status === "SERVED");
}

/** Looks up one order item's current status directly from the board's own
 *  (polled) order list — never computed/guessed, always read back from
 *  server-confirmed data. Returns null if the item (or its order) isn't in
 *  the list at all, e.g. the order was paid/cancelled since. */
function findItemStatus(orderList: Order[], orderItemId: string): string | null {
  for (const order of orderList) {
    const item = order.items.find((i) => i.id === orderItemId);
    if (item) return item.status;
  }
  return null;
}

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
  addItemToOrder: (orderId: string, menuItemId: string, qty: number) => Promise<{ added: boolean }>;
  payOrder: (orderId: string, options?: PayOrderOptions) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [isPending, startTransition] = useTransition();
  // Per-item in-flight tracking for the status-advance button — separate
  // from `isPending` above (which stays shared, and still gates the
  // checkout button exactly as before). Without this, `isPending` being one
  // flag for the whole board meant every item's advance button re-enabled
  // together, and a rapid re-tap on the same item (before the next 4s poll
  // shows its new status) could silently skip a kitchen stage
  // (PENDING straight to SERVED) since advanceOrderItemStatus recomputes
  // "next" from whatever status the row currently has server-side.
  //
  // The actual re-entry guard is `inFlightItemIdsRef`, not this state: two
  // calls to handleAdvance for the same item can happen before React has
  // re-rendered with the previous setPendingItemIds update committed, so a
  // check against `pendingItemIds` state alone would read the same stale
  // (not-yet-added) value in both calls and let both through. A ref mutates
  // synchronously and is visible to every call immediately, including ones
  // in the same tick. `pendingItemIds` state still exists solely to drive
  // the button's `disabled` rendering — React state is what triggers a
  // re-render, a ref by itself does not.
  //
  // Maps orderItemId -> the status that item had at the moment its advance
  // was submitted (not a Set): the server call succeeding is not enough to
  // release the lock, because `orders` below is fed only by the 4s poll —
  // router.refresh() does not update it (it re-renders the server tree, but
  // this component's `orders` state was seeded once from props on mount and
  // never re-adopts a later prop value). Releasing right when the promise
  // settles would re-enable the button while it's still showing the OLD
  // status/label, inviting a second tap that the server would then
  // genuinely advance an extra stage. So the lock is only released once
  // polled data confirms the change — see the poll callback below — by
  // comparing against this captured snapshot, never by computing/guessing a
  // next status.
  const inFlightItemIdsRef = useRef<Map<string, string>>(new Map());
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const router = useRouter();
  const newOrderIds = useNewOrderAlert(orders);
  const checkoutOrder = orders.find((o) => o.id === checkoutOrderId) ?? null;

  // Guards against overlapping polls applying out of order: the interval
  // fires every 4s regardless of whether the previous fetch/response cycle
  // finished, so a slower earlier-dispatched request's response can arrive
  // after a faster later one's. Each poll captures the sequence number it
  // was dispatched with; a response only applies (setOrders, lock
  // confirmation) if that number is still the latest one dispatched by the
  // time the response comes back — otherwise it's a superseded response and
  // is discarded entirely, exactly as if it had never arrived.
  const pollSeqRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(async () => {
      const seq = ++pollSeqRef.current;
      try {
        const res = await fetch("/api/staff/orders/active", { cache: "no-store" });
        if (seq !== pollSeqRef.current) return; // superseded by a later poll — discard
        if (!res.ok) return;
        const data = await res.json();
        if (seq !== pollSeqRef.current) return; // superseded while awaiting res.json()
        const freshOrders: Order[] = data.orders;

        // Release an item's advance-lock only once this poll response
        // itself confirms the change — either the item's status no longer
        // matches what was captured at submission time (handleAdvance), or
        // the item/order isn't in the list anymore (paid/cancelled
        // meanwhile). A response that still shows the submitted status (a
        // slow/stale one) must not release it. No fixed timeout, no
        // client-computed "next" status — only ever a comparison against
        // the snapshot captured at submit time. This runs here (inside the
        // same async poll callback that already sets `orders`), not as a
        // separate effect keyed on `orders`, since polled data is the only
        // source of truth this check is allowed to use.
        if (inFlightItemIdsRef.current.size > 0) {
          const confirmed: string[] = [];
          for (const [orderItemId, submittedStatus] of inFlightItemIdsRef.current) {
            const currentStatus = findItemStatus(freshOrders, orderItemId);
            if (currentStatus === null || currentStatus !== submittedStatus) {
              confirmed.push(orderItemId);
            }
          }
          if (confirmed.length > 0) {
            for (const id of confirmed) inFlightItemIdsRef.current.delete(id);
            setPendingItemIds((prev) => {
              const next = new Set(prev);
              for (const id of confirmed) next.delete(id);
              return next;
            });
          }
        }

        setOrders(freshOrders);
      } catch {
        // ignore transient network errors while polling
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  function handleAdvance(orderItemId: string) {
    if (inFlightItemIdsRef.current.has(orderItemId)) return;
    const submittedStatus = findItemStatus(orders, orderItemId);
    if (submittedStatus === null) return; // not in the current board data — nothing to advance
    inFlightItemIdsRef.current.set(orderItemId, submittedStatus);
    setPendingItemIds((prev) => new Set(prev).add(orderItemId));
    startTransition(async () => {
      try {
        await advanceOrderItemStatus(orderItemId);
        router.refresh();
        // Do not release the lock here — the write succeeding doesn't mean
        // this board's own `orders` reflects it yet. The poll callback
        // above releases it once polled data actually confirms the change.
      } catch (err) {
        toast(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ", "error");
        inFlightItemIdsRef.current.delete(orderItemId);
        setPendingItemIds((prev) => {
          const next = new Set(prev);
          next.delete(orderItemId);
          return next;
        });
      }
    });
  }

  function handlePaid(orderId: string) {
    setCheckoutOrderId(null);
    router.push(`/receipt/${orderId}`);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => {
          const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
          const isNew = newOrderIds.has(order.id);
          const readyForPayment = isReadyForPayment(order.items);
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
                  {!isNew && readyForPayment && <Badge tone="success">พร้อมเก็บเงิน</Badge>}
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
                        disabled={pendingItemIds.has(item.id)}
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
                    onClick={() => setCheckoutOrderId(order.id)}
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

      <CheckoutModal
        key={checkoutOrderId ?? "closed"}
        open={checkoutOrderId !== null}
        order={checkoutOrder}
        payOrder={payOrder}
        onClose={() => setCheckoutOrderId(null)}
        onPaid={handlePaid}
      />
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
  addItemToOrder: (orderId: string, menuItemId: string, qty: number) => Promise<{ added: boolean }>;
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
              const result = await addItemToOrder(orderId, menuItemId, qty);
              if (!result.added) {
                toast("ออเดอร์นี้ไม่สามารถเพิ่มรายการได้แล้ว อาจถูกชำระเงินหรือยกเลิกไปแล้วจากอุปกรณ์อื่น", "error");
                return;
              }
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
