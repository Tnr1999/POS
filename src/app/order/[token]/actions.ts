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
 * Places (or adds to) the open order for a table's current occupancy round.
 *
 * Phase 2D.4 semantic change: `token` used to be a Table.token (permanent,
 * one per table). It is now a TableSession.token (one per occupancy round —
 * see prisma/schema.prisma's TableSession doc comment). This is the
 * authoritative access boundary for customer ordering: a token only works
 * while its session is ACTIVE. A closed session's token is dead forever —
 * it never falls back to Table.token, never resolves to whatever session is
 * ACTIVE on the table now, and is never silently remapped or reopened. The
 * external signature is kept as `(token, cart, idempotencyKey?)` on purpose
 * to avoid churn in OrderClient.tsx/CartFlowSheet.tsx, which only pass this
 * value through without interpreting it.
 *
 * Concurrency: two devices scanning the same QR and submitting at the same
 * instant used to be able to each create their own separate OPEN Order
 * (classic check-then-act race on the findFirst/create below). We take a
 * row lock on the Table itself — not just the TableSession — as the very
 * first statement inside the transaction, the same primitive
 * openTableSession/closeTableSession use, so a customer submitting at the
 * exact moment staff closes this session (or opens a new one) always
 * serializes against it instead of racing it. The session is re-read AFTER
 * the lock is acquired and its ACTIVE-ness re-verified there; the token
 * lookup done before the transaction only exists to learn which Table to
 * lock next and is never trusted for anything past that point. Every
 * concurrent placeOrder call for the same table then serializes behind the
 * lock, so the second call's findFirst always sees the first call's
 * already-committed Order (or none, if this really is the first request),
 * never a half-finished one.
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
 * only those. This is unaffected by the session becoming CLOSED between the
 * original attempt and the retry: the retry re-resolves and re-verifies the
 * session exactly like a first attempt would, so a session that closed in
 * between now correctly rejects the retry too — an old idempotencyKey does
 * not grant access to a session that has since closed.
 */
export async function placeOrder(
  token: string,
  cart: CartLine[],
  idempotencyKey?: string
): Promise<PlaceOrderResult> {
  const EXPIRED_MESSAGE = "QR นี้หมดอายุแล้ว กรุณาสแกน QR ใหม่จากโต๊ะ";

  // Pre-lock read: only used to learn which Table to lock next. Never
  // trusted past that — the authoritative check happens again after the
  // lock is held (see below).
  const initialSession = await prisma.tableSession.findUnique({ where: { token } });
  if (!initialSession) {
    throw new Error(EXPIRED_MESSAGE);
  }
  const tableId = initialSession.tableId;

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
    // statement in the transaction so it covers everything below, including
    // the session re-verification.
    await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;

    // Re-read and re-verify the session now that the lock is held: staff
    // may have closed this session (or opened a new one) while we were
    // waiting for the lock. Only this post-lock state counts.
    const session = await tx.tableSession.findUnique({ where: { token } });
    if (!session || session.tableId !== tableId || session.status !== "ACTIVE") {
      throw new Error(EXPIRED_MESSAGE);
    }

    let order = await tx.order.findFirst({
      where: { tableSessionId: session.id, status: "OPEN" },
    });
    if (!order) {
      order = await tx.order.create({
        data: { tableId, tableSessionId: session.id, type: "DINE_IN", status: "OPEN" },
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
