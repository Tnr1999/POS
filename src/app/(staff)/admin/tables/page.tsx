import QRCode from "qrcode";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConfirmButton } from "@/components/ConfirmButton";
import { createTable, deleteTable, regenerateTableToken } from "./actions";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default async function TablesAdminPage() {
  const tables = await prisma.table.findMany({ orderBy: { createdAt: "asc" } });
  const baseUrl = getBaseUrl();

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const orderUrl = `${baseUrl}/order/${table.token}`;
      const qrDataUrl = await QRCode.toDataURL(orderUrl, { margin: 1, width: 240 });
      return { ...table, orderUrl, qrDataUrl };
    })
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">จัดการโต๊ะ / QR code สั่งอาหาร</h1>
        <Link
          href="/admin/tables/print"
          className="bg-(--accent) text-white rounded-lg px-4 py-2.5 text-sm font-medium text-center"
        >
          พิมพ์ QR ทุกโต๊ะ
        </Link>
      </div>

      <section className="card p-4">
        <form action={createTable} className="flex gap-2">
          <input
            name="name"
            placeholder="ชื่อโต๊ะ เช่น โต๊ะ 4"
            required
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button className="bg-(--brand) text-(--brand-foreground) rounded-lg px-4 py-2 font-medium">
            เพิ่มโต๊ะ
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tablesWithQr.map((table) => (
          <div key={table.id} className="card p-4 space-y-2 text-center">
            <h2 className="font-semibold">{table.name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={`QR code ${table.name}`} className="mx-auto" />
            <p className="text-xs text-(--text-muted-2) break-all">{table.orderUrl}</p>
            <div className="flex justify-center gap-3 text-sm pt-1">
              <ConfirmButton
                action={async () => {
                  "use server";
                  await regenerateTableToken(table.id);
                }}
                tone="warning"
                confirmTitle="สร้าง QR ใหม่"
                confirmMessage={`QR เดิมของ "${table.name}" ที่พิมพ์ไว้จะใช้ไม่ได้ทันที ต้องพิมพ์แผ่นใหม่ไปแปะแทน — ยืนยัน?`}
                confirmLabel="สร้าง QR ใหม่"
                className="text-amber-600 hover:underline"
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
                className="text-red-600 hover:underline"
              >
                ลบโต๊ะ
              </ConfirmButton>
            </div>
          </div>
        ))}
      </div>
      {tables.length === 0 && (
        <p className="text-sm text-(--text-muted-2)">ยังไม่มีโต๊ะ เพิ่มโต๊ะแรกด้านบน</p>
      )}
    </div>
  );
}
