import QRCode from "qrcode";
import { getTables } from "@/lib/tables";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default async function PrintTablesPage() {
  const tables = await getTables();
  const baseUrl = getBaseUrl();

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const orderUrl = `${baseUrl}/order/${table.token}`;
      const qrDataUrl = await QRCode.toDataURL(orderUrl, { margin: 1, width: 320 });
      return { ...table, orderUrl, qrDataUrl };
    })
  );

  return (
    // Always renders as a light "sheet of paper" preview, independent of
    // site theme — this page's whole purpose is what comes out on paper.
    <div className="max-w-4xl mx-auto space-y-4 bg-white text-black min-h-screen p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print">
        <h1 className="text-2xl font-bold">พิมพ์ QR ทุกโต๊ะ</h1>
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2">
        {tablesWithQr.map((table) => (
          <div
            key={table.id}
            className="border border-black/20 rounded-xl p-6 text-center break-inside-avoid"
          >
            <h2 className="text-xl font-bold mb-2">{table.name}</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={table.name} className="mx-auto" />
            <p className="mt-2 text-sm">สแกนเพื่อสั่งอาหาร</p>
          </div>
        ))}
      </div>
    </div>
  );
}
