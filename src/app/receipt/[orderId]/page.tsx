import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
import { PrintButton } from "@/components/PrintButton";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();

  const total = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "ร้านค้า";
  const when = order.paidAt ?? order.createdAt;

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="no-print max-w-[320px] mx-auto flex justify-between mb-4">
        <Link href="/pos" className="text-sm text-gray-600 hover:underline">
          ← กลับหน้าขาย
        </Link>
        <PrintButton label="พิมพ์ใบเสร็จ" />
      </div>

      <div className="receipt bg-white mx-auto p-4 text-sm font-mono">
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
              <span>{formatBaht(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-dashed border-black my-2" />

        <div className="flex justify-between font-bold text-base">
          <span>รวมทั้งสิ้น</span>
          <span>{formatBaht(total)} บาท</span>
        </div>

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
