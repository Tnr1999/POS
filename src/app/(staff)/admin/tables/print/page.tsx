import QRCode from "qrcode";
import { currentOrderTokenFor, getTablesWithSessions } from "@/lib/tables";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default async function PrintTablesPage() {
  // Phase 2D.4: a printed QR must encode the table's current ACTIVE
  // TableSession token, exactly like the live QR on /admin/tables — never
  // the legacy Table.token, which no longer grants order access at all (see
  // currentOrderTokenFor's doc comment). getTablesWithSessions() already
  // fetches every table's session state in one query (no N+1); a table with
  // no ACTIVE session simply gets no QR here, rendered as a "ยังไม่ได้เปิดรอบ"
  // placeholder below instead of a QR nobody can use.
  const tables = await getTablesWithSessions();
  const baseUrl = getBaseUrl();

  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const sessionToken = currentOrderTokenFor(table);
      const orderUrl = sessionToken ? `${baseUrl}/order/${sessionToken}` : null;
      const qrDataUrl = orderUrl ? await QRCode.toDataURL(orderUrl, { margin: 1, width: 320 }) : null;
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
            {table.qrDataUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={table.qrDataUrl} alt={table.name} className="mx-auto" />
                <p className="mt-2 text-sm">สแกนเพื่อสั่งอาหาร</p>
              </>
            ) : (
              <p className="py-10 text-sm text-black/60">ยังไม่ได้เปิดรอบ — เปิดโต๊ะก่อนจึงจะพิมพ์ QR ได้</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
