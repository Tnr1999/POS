"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { consumeStock } from "@/lib/stock";
import { addOnById, type AddOn } from "@/lib/menuOptions";

export type CartLine = {
  menuItemId: string;
  qty: number;
  note?: string;
  spiceLevel?: string;
  addOnIds?: string[];
};
export type PlaceOrderResult = { unavailable: string[]; orderId: string | null };

/**
 * Places (or adds to) the open order for a table.
 *
 * Concurrency: two devices scanning the same table's QR and submitting at
 * the same instant used to be able to each create their own separate OPEN
 * Order (classic check-then-act race on the findFirst/create below). We now
 * take a row lock on the Table itself as the very first statement inside
 * the transaction — every concurrent placeOrder call for the same table
 * serializes behind it, so the second call's findFirst always sees the
 * first call's already-committed Order (or none, if this really is the
 * first request), never a half-finished one.
 *
 * Idempotency: `idempotencyKey` identifies one "ส่งออเดอร์" submission from
 * the client (see CartFlowSheet.tsx). Each cart line's row is tagged
 * `${idempotencyKey}:${lineIndex}` in OrderItem.idempotencyKey (unique in
 * the DB). If this exact submission is retried — network timeout, the
 * client retrying, or the same request somehow arriving twice — the retry
 * runs in its own serialized transaction (thanks to the same table lock)
 * and sees the first attempt's rows already committed, so it skips
 * re-inserting them instead of duplicating the order. Lines that failed
 * (e.g. stock ran out) were never inserted, so a retry correctly reattempts
 * only those.
 */
export async function placeOrder(
  token: string,
  cart: CartLine[],
  idempotencyKey?: string
): Promise<PlaceOrderResult> {
  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) {
    throw new Error("ไม่พบโต๊ะนี้ กรุณาสแกน QR code ใหม่อีกครั้ง");
  }

  const lines = cart.filter((line) => Number.isInteger(line.qty) && line.qty > 0);
  if (lines.length === 0) return { unavailable: [], orderId: null };

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: lines.map((l) => l.menuItemId) }, active: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  const unavailable: string[] = [];
  let orderId: string | null = null;

  await prisma.$transaction(async (tx) => {
    // Row lock on the Table — see function doc comment. Must be the first
    // statement in the transaction so it covers the find-or-create below.
    await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${table.id} FOR UPDATE`;

    let order = await tx.order.findFirst({
      where: { tableId: table.id, status: "OPEN" },
    });
    if (!order) {
      order = await tx.order.create({
        data: { tableId: table.id, type: "DINE_IN", status: "OPEN" },
      });
    }
    orderId = order.id;

    // Safe to read here: the table lock above guarantees no other
    // placeOrder call for this table is concurrently mid-write.
    const alreadyInserted = idempotencyKey
      ? new Set(
          (
            await tx.orderItem.findMany({
              where: { idempotencyKey: { startsWith: `${idempotencyKey}:` } },
              select: { idempotencyKey: true },
            })
          ).map((r) => r.idempotencyKey)
        )
      : null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineKey = idempotencyKey ? `${idempotencyKey}:${i}` : null;
      if (lineKey && alreadyInserted?.has(lineKey)) continue; // already committed on a prior attempt

      const menuItem = menuItemById.get(line.menuItemId);
      if (!menuItem) continue;

      const qty = Math.min(line.qty, 50);
      const ok = await consumeStock(tx, menuItem, qty);
      if (!ok) {
        unavailable.push(menuItem.name);
        continue;
      }

      // Add-on prices are looked up server-side from the trusted static
      // config — never taken from the client — so the price charged always
      // matches what the kitchen ticket (via `note`) describes.
      const addOns = (line.addOnIds ?? [])
        .map(addOnById)
        .filter((a): a is AddOn => a !== undefined);
      const finalPrice = menuItem.price + addOns.reduce((sum, a) => sum + a.price, 0);

      const noteParts = [
        line.spiceLevel,
        addOns.length > 0 ? addOns.map((a) => a.name).join(", ") : null,
        line.note?.trim() || null,
      ].filter((part): part is string => !!part);

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: finalPrice,
          qty,
          note: noteParts.join(" · ").slice(0, 200) || null,
          status: "PENDING",
          idempotencyKey: lineKey,
        },
      });
    }
  });

  revalidatePath(`/order/${token}`);
  revalidatePath("/pos");

  return { unavailable, orderId };
}
