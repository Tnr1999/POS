import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;

  const today = new Date();
  const fromDate = from ? startOfDay(new Date(from)) : startOfDay(today);
  const toDate = to ? endOfDay(new Date(to)) : endOfDay(today);

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: fromDate, lte: toDate },
    },
    orderBy: { paidAt: "desc" },
    include: { table: true, items: true },
  });

  const totalRevenue = paidOrders.reduce(
    (sum, order) => sum + order.items.reduce((s, i) => s + i.price * i.qty, 0),
    0
  );

  const itemTotals = new Map<string, { qty: number; revenue: number }>();
  for (const order of paidOrders) {
    for (const item of order.items) {
      const existing = itemTotals.get(item.name) ?? { qty: 0, revenue: 0 };
      existing.qty += item.qty;
      existing.revenue += item.price * item.qty;
      itemTotals.set(item.name, existing);
    }
  }
  const topItems = [...itemTotals.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">รายงานยอดขาย</h1>

      <form className="flex flex-wrap items-end gap-3 bg-(--surface) rounded-xl shadow p-4">
        <div>
          <label className="block text-sm font-medium mb-1">จากวันที่</label>
          <input
            type="date"
            name="from"
            defaultValue={toDateInputValue(fromDate)}
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">ถึงวันที่</label>
          <input
            type="date"
            name="to"
            defaultValue={toDateInputValue(toDate)}
            className="border rounded-lg px-3 py-2"
          />
        </div>
        <button className="bg-(--brand) text-(--brand-foreground) rounded-lg px-4 py-2 font-medium">
          ดูรายงาน
        </button>
      </form>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-(--surface) rounded-xl shadow p-4">
          <p className="text-sm text-(--text-muted)">ยอดขายรวม</p>
          <p className="text-2xl font-bold">{formatBaht(totalRevenue)} บาท</p>
        </div>
        <div className="bg-(--surface) rounded-xl shadow p-4">
          <p className="text-sm text-(--text-muted)">จำนวนบิล</p>
          <p className="text-2xl font-bold">{paidOrders.length}</p>
        </div>
      </div>

      <section className="bg-(--surface) rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">เมนูขายดี</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-(--text-muted)">
                <th className="py-1">เมนู</th>
                <th className="py-1 text-right">จำนวน</th>
                <th className="py-1 text-right">ยอดขาย</th>
              </tr>
            </thead>
            <tbody>
              {topItems.map(([name, data]) => (
                <tr key={name} className="border-t">
                  <td className="py-1">{name}</td>
                  <td className="py-1 text-right">{data.qty}</td>
                  <td className="py-1 text-right">{formatBaht(data.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {topItems.length === 0 && (
          <p className="text-sm text-(--text-muted-2)">ไม่มีข้อมูลในช่วงเวลานี้</p>
        )}
      </section>

      <section className="bg-(--surface) rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">รายการบิล</h2>
        <ul className="divide-y text-sm">
          {paidOrders.map((order) => {
            const total = order.items.reduce((s, i) => s + i.price * i.qty, 0);
            return (
              <li key={order.id} className="py-2 flex justify-between">
                <span>
                  {order.table?.name ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
                  {" · "}
                  {order.paidAt?.toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-medium">{formatBaht(total)} บาท</span>
              </li>
            );
          })}
        </ul>
        {paidOrders.length === 0 && (
          <p className="text-sm text-(--text-muted-2)">ยังไม่มีบิลที่ชำระในช่วงเวลานี้</p>
        )}
      </section>
    </div>
  );
}
