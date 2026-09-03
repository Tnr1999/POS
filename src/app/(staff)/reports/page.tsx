import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { resolveOrderTotals } from "@/lib/orderTotals";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { ReportsFilterBar } from "./ReportsFilterBar";
import { ReportsSkeleton } from "./ReportsSkeleton";
import { DailyRevenueChart } from "./DailyRevenueChart";

const MAX_CHART_DAYS = 62;

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

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="page-title">รายงานยอดขาย</h1>

      <ReportsFilterBar from={toDateInputValue(fromDate)} to={toDateInputValue(toDate)} />

      <Suspense key={`${fromDate.getTime()}-${toDate.getTime()}`} fallback={<ReportsSkeleton />}>
        <ReportsData fromDate={fromDate} toDate={toDate} />
      </Suspense>
    </div>
  );
}

async function ReportsData({ fromDate, toDate }: { fromDate: Date; toDate: Date }) {
  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PAID",
      paidAt: { gte: fromDate, lte: toDate },
    },
    orderBy: { paidAt: "desc" },
    include: { table: true, items: true },
  });

  // Revenue is grandTotalAmount (what was actually charged) for orders with
  // a payment snapshot, falling back to the item sum for orders paid before
  // the snapshot existed — never paidAmount, which can exceed the sale for
  // a CASH payment with change owed.
  const orderTotals = new Map(paidOrders.map((order) => [order.id, resolveOrderTotals(order)]));
  const totalRevenue = paidOrders.reduce((sum, order) => sum + orderTotals.get(order.id)!.grandTotalAmount, 0);
  const avgPerBill = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

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

  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const chartDays =
    dayCount <= MAX_CHART_DAYS
      ? Array.from({ length: dayCount }, (_, i) => {
          const dayStart = startOfDay(new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000));
          const dayEnd = endOfDay(dayStart);
          const revenue = paidOrders
            .filter((o) => o.paidAt && o.paidAt >= dayStart && o.paidAt <= dayEnd)
            .reduce((s, o) => s + orderTotals.get(o.id)!.grandTotalAmount, 0);
          return {
            label: dayStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
            revenue,
          };
        })
      : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="ยอดขายรวม"
          tone="brand"
          value={
            <>
              {formatBaht(totalRevenue)} <span className="text-sm font-normal">บาท</span>
            </>
          }
        />
        <StatCard label="จำนวนบิล" tone="brand" value={paidOrders.length} />
        <StatCard
          label="ยอดเฉลี่ยต่อบิล"
          tone="brand"
          className="col-span-2 sm:col-span-1"
          value={
            <>
              {formatBaht(avgPerBill)} <span className="text-sm font-normal">บาท</span>
            </>
          }
        />
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">ยอดขายรายวัน</h2>
        {chartDays === null ? (
          <p className="text-sm text-(--text-muted-2)">ช่วงเวลาที่เลือกยาวเกินไปสำหรับแสดงกราฟ</p>
        ) : paidOrders.length === 0 ? (
          <EmptyState title="ไม่มีข้อมูลในช่วงเวลานี้" />
        ) : (
          <DailyRevenueChart days={chartDays} />
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">เมนูขายดี</h2>
        {topItems.length === 0 ? (
          <EmptyState title="ไม่มีข้อมูลในช่วงเวลานี้" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-(--text-muted)">
                  <th className="py-1.5 font-medium">เมนู</th>
                  <th className="py-1.5 font-medium text-right">จำนวน</th>
                  <th className="py-1.5 font-medium text-right">ยอดขาย</th>
                </tr>
              </thead>
              <tbody>
                {topItems.map(([name, data]) => (
                  <tr key={name} className="border-t border-(--surface-border)">
                    <td className="py-1.5">{name}</td>
                    <td className="py-1.5 text-right">{data.qty}</td>
                    <td className="py-1.5 text-right">{formatBaht(data.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">รายการบิล</h2>
        {paidOrders.length === 0 ? (
          <EmptyState title="ยังไม่มีบิลที่ชำระในช่วงเวลานี้" />
        ) : (
          <ul className="divide-y divide-(--surface-border) text-sm">
            {paidOrders.map((order) => {
              const total = orderTotals.get(order.id)!.grandTotalAmount;
              const shortId = order.id.slice(-6).toUpperCase();
              return (
                <li key={order.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {order.table?.name ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
                    </p>
                    <p className="text-xs text-(--text-muted-2)">
                      #ORD-{shortId} ·{" "}
                      {order.paidAt?.toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="font-semibold shrink-0">{formatBaht(total)} บาท</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
