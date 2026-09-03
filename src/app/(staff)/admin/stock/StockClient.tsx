"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { StockStatusBadge } from "@/components/StatusBadge";
import { stockStatusOf } from "@/lib/stockStatus";
import { EditIcon } from "@/components/icons";

type TrackedItem = { id: string; name: string; stock: number; trackStock: boolean };
type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  note: string | null;
  createdAt: string;
  itemName: string;
};

const MOVEMENT_LABEL: Record<string, string> = {
  SALE: "ขายออก",
  RESTORE: "คืนสต็อก (ยกเลิกออเดอร์)",
  RESTOCK: "รับสต็อกเข้า",
  ADJUSTMENT: "แก้ไขจากหน้าเมนู",
};

export function StockClient({
  trackedItems,
  movements,
  restockItem,
}: {
  trackedItems: TrackedItem[];
  movements: Movement[];
  restockItem: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [restockTarget, setRestockTarget] = useState<TrackedItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const item of trackedItems) {
      const status = stockStatusOf(item);
      if (status === "low") low++;
      if (status === "out") out++;
    }
    return { total: trackedItems.length, low, out };
  }, [trackedItems]);

  function handleRestockSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await restockItem(formData);
        setRestockTarget(null);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "ปรับสต็อกไม่สำเร็จ", "error");
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">คลังสินค้า / สต็อก</h1>
        <Button href="/admin/menu" variant="ghost" size="sm" className="shrink-0">
          จัดการเมนู →
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="วัตถุดิบทั้งหมด" value={stats.total} className="col-span-2 sm:col-span-1" />
        <StatCard label="ใกล้หมด" value={stats.low} tone="warning" />
        <StatCard label="หมดแล้ว" value={stats.out} tone="danger" />
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">สต็อกปัจจุบัน</h2>
        {trackedItems.length === 0 ? (
          <EmptyState
            title="ยังไม่มีเมนูที่เปิดใช้การตัดสต็อก"
            description='ไปเปิดได้ที่ "จัดการเมนู" แล้วติ๊ก "ตัดสต็อกอัตโนมัติเมื่อขาย" ในแต่ละเมนู'
            action={
              <Button href="/admin/menu" size="sm">
                ไปที่จัดการเมนู
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-(--text-muted)">
                    <th className="py-2 font-medium">เมนู</th>
                    <th className="py-2 font-medium">คงเหลือ</th>
                    <th className="py-2 font-medium">สถานะ</th>
                    <th className="py-2 font-medium text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedItems.map((item) => (
                    <tr key={item.id} className="border-t border-(--surface-border)">
                      <td className="py-2.5">{item.name}</td>
                      <td className="py-2.5">{item.stock}</td>
                      <td className="py-2.5">
                        <StockStatusBadge item={item} />
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRestockTarget(item)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--accent) hover:underline"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                          ปรับสต็อก
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <ul className="sm:hidden space-y-2">
              {trackedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-(--surface-border) p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-sm text-(--text-muted)">เหลือ {item.stock} ชิ้น</p>
                    <div className="mt-1">
                      <StockStatusBadge item={item} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestockTarget(item)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-(--accent) shrink-0"
                  >
                    <EditIcon className="w-3.5 h-3.5" />
                    ปรับสต็อก
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">ประวัติการเคลื่อนไหวล่าสุด</h2>
        {movements.length === 0 ? (
          <EmptyState title="ยังไม่มีความเคลื่อนไหว" />
        ) : (
          <ul className="divide-y divide-(--surface-border) text-sm">
            {movements.map((m) => (
              <li key={m.id} className="py-2 flex justify-between gap-2">
                <div>
                  <p>
                    {m.itemName} — {MOVEMENT_LABEL[m.type] ?? m.type}
                    {m.note && <span className="text-(--text-muted-2)"> ({m.note})</span>}
                  </p>
                  <p className="text-xs text-(--text-muted-2)">
                    {new Date(m.createdAt).toLocaleString("th-TH")}
                  </p>
                </div>
                <span
                  className={`font-medium shrink-0 ${
                    m.qtyChange > 0 ? "text-(--text-success)" : "text-(--text-danger)"
                  }`}
                >
                  {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={restockTarget !== null}
        onClose={() => !isPending && setRestockTarget(null)}
        title={restockTarget ? `ปรับสต็อก: ${restockTarget.name}` : undefined}
      >
        {restockTarget && (
          <form onSubmit={handleRestockSubmit} className="space-y-3">
            <input type="hidden" name="menuItemId" value={restockTarget.id} />
            <p className="text-sm text-(--text-muted)">คงเหลือปัจจุบัน: {restockTarget.stock} ชิ้น</p>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="restock-qty">
                จำนวนที่เปลี่ยน (+ รับเข้า / - ตัดออก)
              </label>
              <Input id="restock-qty" name="qty" type="number" step="1" placeholder="เช่น 10 หรือ -2" required />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1" htmlFor="restock-note">
                หมายเหตุ (ไม่บังคับ)
              </label>
              <Input id="restock-note" name="note" placeholder="เช่น รับของจากซัพพลายเออร์" />
            </div>
            <Button type="submit" fullWidth disabled={isPending}>
              {isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
