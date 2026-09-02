import QRCode from "qrcode";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
          className="bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-medium text-center"
        >
          พิมพ์ QR ทุกโต๊ะ
        </Link>
      </div>

      <section className="bg-white rounded-xl shadow p-4">
        <form action={createTable} className="flex gap-2">
          <input
            name="name"
            placeholder="ชื่อโต๊ะ เช่น โต๊ะ 4"
            required
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button className="bg-black text-white rounded-lg px-4 py-2 font-medium">
            เพิ่มโต๊ะ
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tablesWithQr.map((table) => (
          <div key={table.id} className="bg-white rounded-xl shadow p-4 space-y-2 text-center">
            <h2 className="font-semibold">{table.name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={`QR code ${table.name}`} className="mx-auto" />
            <p className="text-xs text-gray-400 break-all">{table.orderUrl}</p>
            <div className="flex justify-center gap-3 text-sm pt-1">
              <form
                action={async () => {
                  "use server";
                  await regenerateTableToken(table.id);
                }}
              >
                <button className="text-amber-600 hover:underline">
                  สร้าง QR ใหม่
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteTable(table.id);
                }}
              >
                <button className="text-red-600 hover:underline">ลบโต๊ะ</button>
              </form>
            </div>
          </div>
        ))}
      </div>
      {tables.length === 0 && (
        <p className="text-sm text-gray-400">ยังไม่มีโต๊ะ เพิ่มโต๊ะแรกด้านบน</p>
      )}
    </div>
  );
}
