import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { restockItem } from "./actions";

export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, string> = {
  SALE: "ขายออก",
  RESTORE: "คืนสต็อก (ยกเลิกออเดอร์)",
  RESTOCK: "รับสต็อกเข้า",
  ADJUSTMENT: "แก้ไขจากหน้าเมนู",
};

export default async function StockPage() {
  const [trackedItems, movements] = await Promise.all([
    prisma.menuItem.findMany({
      where: { trackStock: true },
      orderBy: { stock: "asc" },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { menuItem: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">คลังสินค้า / สต็อก</h1>
        <Link href="/admin/menu" className="text-sm text-gray-600 hover:underline">
          จัดการเมนู →
        </Link>
      </div>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">สต็อกปัจจุบัน</h2>
        {trackedItems.length === 0 && (
          <p className="text-sm text-gray-400">
            ยังไม่มีเมนูที่เปิดใช้การตัดสต็อก ไปเปิดได้ที่{" "}
            <Link href="/admin/menu" className="underline">
              จัดการเมนู
            </Link>{" "}
            (ติ๊ก &quot;ตัดสต็อก&quot; ในแต่ละเมนู)
          </p>
        )}
        <ul className="divide-y">
          {trackedItems.map((item) => (
            <li key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p
                  className={`text-sm ${
                    item.stock <= 5 ? "text-red-600 font-medium" : "text-gray-500"
                  }`}
                >
                  เหลือ {item.stock} ชิ้น {item.stock <= 5 && "(ใกล้หมด)"}
                </p>
              </div>
              <form action={restockItem} className="flex items-center gap-2">
                <input type="hidden" name="menuItemId" value={item.id} />
                <input
                  name="qty"
                  type="number"
                  step="1"
                  placeholder="+จำนวน"
                  required
                  className="border rounded-lg px-3 py-2 w-24"
                />
                <input
                  name="note"
                  placeholder="หมายเหตุ (ไม่บังคับ)"
                  className="border rounded-lg px-3 py-2 flex-1 min-w-[120px]"
                />
                <button className="bg-black text-white rounded-lg px-4 py-2 text-sm font-medium">
                  บันทึก
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">ประวัติการเคลื่อนไหวล่าสุด</h2>
        <ul className="divide-y text-sm">
          {movements.map((m) => (
            <li key={m.id} className="py-2 flex justify-between gap-2">
              <div>
                <p>
                  {m.menuItem.name} — {MOVEMENT_LABEL[m.type] ?? m.type}
                  {m.note && <span className="text-gray-400"> ({m.note})</span>}
                </p>
                <p className="text-xs text-gray-400">
                  {m.createdAt.toLocaleString("th-TH")}
                </p>
              </div>
              <span
                className={
                  m.qtyChange > 0
                    ? "text-green-600 font-medium shrink-0"
                    : "text-red-600 font-medium shrink-0"
                }
              >
                {m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange}
              </span>
            </li>
          ))}
        </ul>
        {movements.length === 0 && (
          <p className="text-sm text-gray-400">ยังไม่มีความเคลื่อนไหว</p>
        )}
      </section>
    </div>
  );
}
