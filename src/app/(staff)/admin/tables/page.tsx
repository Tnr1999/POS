import { Suspense } from "react";
import QRCode from "qrcode";
import { currentOrderTokenFor, getTablesWithSessions } from "@/lib/tables";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { TablesSkeleton } from "./TablesSkeleton";
import { TableSessionPanel } from "./TableSessionPanel";
import { createTable, deleteTable, regenerateTableToken, openTableSession, closeTableSession } from "./actions";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export default function TablesAdminPage() {
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

      <Suspense fallback={<TablesSkeleton />}>
        <TablesGrid />
      </Suspense>
    </div>
  );
}

async function TablesGrid() {
  // Table identity + session state — session status is live service state
  // (staff opening/closing rounds, customers placing orders), so this is
  // deliberately uncached (see getTablesWithSessions's doc comment).
  const tables = await getTablesWithSessions();
  const baseUrl = getBaseUrl();

  // Phase 2D.4: the QR customers can actually order through must encode the
  // current ACTIVE TableSession's token, not the permanent Table.token —
  // an old session's QR (and Table.token itself) no longer works for
  // ordering once that session closes. With no ACTIVE session yet, there is
  // no working customer QR to show at all (rendered below as a prompt to
  // open the table first), never a fallback to Table.token. Same derivation
  // as /admin/tables/print (currentOrderTokenFor).
  const tablesWithQr = await Promise.all(
    tables.map(async (table) => {
      const sessionToken = currentOrderTokenFor(table);
      const orderUrl = sessionToken ? `${baseUrl}/order/${sessionToken}` : null;
      const qrDataUrl = orderUrl ? await QRCode.toDataURL(orderUrl, { margin: 1, width: 240 }) : null;
      return { ...table, orderUrl, qrDataUrl };
    })
  );

  if (tablesWithQr.length === 0) {
    return (
      <EmptyState
        title="ยังไม่มีโต๊ะ"
        description="เพิ่มโต๊ะแรกด้านบน แล้วพิมพ์ QR ไปแปะที่โต๊ะให้ลูกค้าสแกนสั่งอาหาร"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tablesWithQr.map((table) => (
        <div key={table.id} className="card p-4 space-y-3 text-center">
          <h2 className="card-title">{table.name}</h2>

          <TableSessionPanel
            tableId={table.id}
            tableName={table.name}
            activeSession={table.activeSession}
            openTableSession={openTableSession}
            closeTableSession={closeTableSession}
          />

          {table.qrDataUrl && table.orderUrl ? (
            <>
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
            </>
          ) : (
            <p className="text-xs text-(--text-muted-2) py-6">เปิดโต๊ะก่อน เพื่อสร้าง QR สำหรับลูกค้าสั่งอาหาร</p>
          )}
          <div className="flex justify-center gap-4 text-sm pt-2 border-t border-(--surface-border)">
            <ConfirmButton
              action={async () => {
                "use server";
                await regenerateTableToken(table.id);
              }}
              tone="warning"
              confirmTitle="สร้าง QR ใหม่"
              confirmMessage={`QR ที่เคยพิมพ์ไว้สำหรับ "${table.name}" จะใช้ไม่ได้ทันที ต้องพิมพ์แผ่นใหม่ไปแปะแทน (ไม่กระทบ QR สั่งอาหารของรอบที่เปิดอยู่ตอนนี้) — ยืนยัน?`}
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
  );
}
