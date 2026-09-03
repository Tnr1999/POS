import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { resolveOrderTotals } from "@/lib/orderTotals";
import { PrintButton } from "@/components/PrintButton";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  QR_PAYMENT: "QR พร้อมเพย์",
};

/** Display-only: formats an integer satang amount as a fixed 2-decimal Baht
 *  string. Never used to derive a new amount — every value passed in here
 *  already comes from resolveOrderTotals (a DB snapshot or a plain item
 *  sum), never recomputed by multiplying/dividing by a rate here. */
function money(satang: number): string {
  return `฿${(satang / 100).toFixed(2)}`;
}

/** Basis points (1 bp = 0.01%) to a plain percent label, e.g. 700 -> "7%". Display only. */
function ratePercent(basisPoints: number): string {
  return `${basisPoints / 100}%`;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  // Looked up strictly by the path's orderId — nothing about the amounts
  // shown below ever comes from a query string or other client input.
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const totals = resolveOrderTotals(order);
  const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "ร้านค้า";
  const when = order.paidAt ?? order.createdAt;

  return (
    <div className="min-h-screen bg-(--surface-muted) py-8 px-4">
      <div className="no-print max-w-[320px] mx-auto flex justify-between mb-4">
        <Link href="/pos" className="text-sm text-(--text-subtle) hover:underline">
          ← กลับหน้าขาย
        </Link>
        <PrintButton label="พิมพ์ใบเสร็จ" />
      </div>

      {/* The printed slip itself stays literal white/black on-screen too —
          it's meant to preview exactly what comes out of the receipt
          printer, independent of the site's own light/dark theme. */}
      <div className="receipt bg-white text-black mx-auto p-4 text-sm font-mono">
        <div className="text-center space-y-1 mb-3">
          <p className="font-bold text-base">{shopName}</p>
          <p>
            {order.table?.name ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
          </p>
          <p>
            {when.toLocaleDateString("th-TH")}{" "}
            {when.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2">
              <span className="flex-1">
                {item.name} x{item.qty}
              </span>
              <span>{money(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-dashed border-black my-2" />

        {totals.source === "snapshot" ? (
          <>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>ยอดรวม</span>
                <span>{money(totals.subtotalAmount)}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span>ส่วนลด</span>
                  <span>-{money(totals.discountAmount)}</span>
                </div>
              )}
              {totals.serviceChargeAmount > 0 && (
                <div className="flex justify-between">
                  <span>Service charge {ratePercent(totals.serviceChargeRate)}</span>
                  <span>{money(totals.serviceChargeAmount)}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>VAT {ratePercent(totals.taxRate)}</span>
                  <span>{money(totals.taxAmount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-black my-2" />

            <div className="flex justify-between font-bold text-base">
              <span>ยอดที่ต้องชำระ</span>
              <span>{money(totals.grandTotalAmount)}</span>
            </div>

            {totals.paymentMethod && (
              <div className="mt-2 space-y-0.5">
                <div className="flex justify-between">
                  <span>ชำระโดย</span>
                  <span>{PAYMENT_METHOD_LABEL[totals.paymentMethod]}</span>
                </div>
                {totals.paidAmount != null && (
                  <div className="flex justify-between">
                    <span>รับเงิน</span>
                    <span>{money(totals.paidAmount)}</span>
                  </div>
                )}
                {totals.paymentMethod === "CASH" && totals.changeAmount != null && (
                  <div className="flex justify-between">
                    <span>เงินทอน</span>
                    <span>{money(totals.changeAmount)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // Legacy order paid before the payment snapshot existed — show
          // only what we actually know (the item sum), never a guessed
          // payment method, discount, service charge, or tax.
          <div className="flex justify-between font-bold text-base">
            <span>รวมทั้งสิ้น</span>
            <span>{money(totals.grandTotalAmount)}</span>
          </div>
        )}

        <p className="text-center mt-4">ขอบคุณที่ใช้บริการ</p>
      </div>

      <style>{`
        .receipt {
          width: 80mm;
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            background: white;
          }
          .receipt {
            width: 100%;
            padding: 4mm;
          }
        }
      `}</style>
    </div>
  );
}
