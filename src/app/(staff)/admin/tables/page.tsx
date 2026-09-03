import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { createTable, deleteTable, regenerateTableToken } from "./actions";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default async function TablesAdminPage() {
  const tables = await prisma.table.findMany({ orderBy: { createdAt: "asc" } });
  const baseUrl = getBaseUrl();

  const openOrders = await prisma.order.findMany({
    where: { tableId: { in: tables.map((t) => t.id) }, status: "OPEN" },
    select: { tableId: true },
  });
  const tablesWithOpenOrder = new Set(openOrders.map((o) => o.tableId));

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const orderUrl = `${baseUrl}/order/${table.token}`;
      const qrDataUrl = await QRCode.toDataURL(orderUrl, { margin: 1, width: 240 });
      return { ...table, orderUrl, qrDataUrl, hasOpenOrder: tablesWithOpenOrder.has(table.id) };
    })
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">จัดการโต๊ะ / QR</h1>
        <Button href="/admin/tables/print" variant="accent">
          พิมพ์ QR ทุกโต๊ะ
        </Button>
      </div>

      <section className="card p-4">
        <form action={createTable} className="flex gap-2">
          <Input name="name" placeholder="ชื่อโต๊ะ เช่น โต๊ะ 4" required className="flex-1" />
          <Button type="submit">เพิ่มโต๊ะ</Button>
        </form>
      </section>

      {tablesWithQr.length === 0 ? (
        <EmptyState
          title="ยังไม่มีโต๊ะ"
          description="เพิ่มโต๊ะแรกด้านบน แล้วพิมพ์ QR ไปแปะที่โต๊ะให้ลูกค้าสแกนสั่งอาหาร"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tablesWithQr.map((table) => (
            <div key={table.id} className="card p-4 space-y-3 text-center">
              <div className="flex items-center justify-between gap-2">
                <h2 className="card-title">{table.name}</h2>
                <Badge tone={table.hasOpenOrder ? "warning" : "success"}>
                  {table.hasOpenOrder ? "มีออเดอร์ค้าง" : "พร้อมใช้งาน"}
                </Badge>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={table.qrDataUrl}
                alt={`QR code สั่งอาหารสำหรับ ${table.name}`}
                className="mx-auto rounded-lg border border-(--surface-border)"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-(--text-muted-2) break-all text-left">{table.orderUrl}</p>
                <CopyLinkButton url={table.orderUrl} className="shrink-0" />
              </div>
              <div className="flex justify-center gap-4 text-sm pt-2 border-t border-(--surface-border)">
                <ConfirmButton
                  action={async () => {
                    "use server";
                    await regenerateTableToken(table.id);
                  }}
                  tone="warning"
                  confirmTitle="สร้าง QR ใหม่"
                  confirmMessage={`QR เดิมของ "${table.name}" ที่พิมพ์ไว้จะใช้ไม่ได้ทันที ต้องพิมพ์แผ่นใหม่ไปแปะแทน — ยืนยัน?`}
                  confirmLabel="สร้าง QR ใหม่"
                  className="text-(--text-warning) hover:underline"
                >
                  สร้าง QR ใหม่
                </ConfirmButton>
                <ConfirmButton
                  action={async () => {
                    "use server";
                    await deleteTable(table.id);
                  }}
                  confirmTitle="ลบโต๊ะ"
                  confirmMessage={`ลบ "${table.name}"? ลบแล้วกู้คืนไม่ได้ (ลบไม่ได้ถ้ายังมีออเดอร์ค้างอยู่)`}
                  confirmLabel="ลบโต๊ะ"
                  className="text-(--text-danger) hover:underline"
                >
                  ลบโต๊ะ
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
