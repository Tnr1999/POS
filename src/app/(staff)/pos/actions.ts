"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { consumeStock, restoreStock } from "@/lib/stock";
import { computeOrderPricing, isPaymentMethod, validatePayment, type DiscountInput } from "@/lib/pricing";

const ITEM_STATUS_ORDER = ["PENDING", "PREPARING", "SERVED"];

export async function advanceOrderItemStatus(orderItemId: string) {
  await requireStaff();
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return;

  const currentIndex = ITEM_STATUS_ORDER.indexOf(item.status);
  const next = ITEM_STATUS_ORDER[currentIndex + 1];
  if (!next) return;

  // Atomic conditional update (same guard pattern as cancelOrder/payOrder in
  // this file): only applies if the row's status is still exactly what was
  // just read above. Without this, two concurrent calls starting from the
  // same status both compute the same `next` from the same stale read and
  // both write it — silently losing one of the two intended transitions
  // (e.g. two concurrent advances from PENDING both landing on PREPARING
  // instead of one of them reaching SERVED). Whichever call's UPDATE
  // commits first wins; the other's WHERE clause no longer matches (the
  // status has already moved on) and it safely no-ops instead of
  // overwriting — exactly like a retried/duplicated request, never an
  // error, since the caller has no way to tell "lost the race" apart from
  // "someone else already did this" and neither needs surfacing to staff.
  const result = await prisma.orderItem.updateMany({
    where: { id: orderItemId, status: item.status },
    data: { status: next },
  });
  if (result.count === 0) return;

  revalidatePath("/pos");
}

/**
 * Adds one line to an OPEN order. Returns `{ added: false }` — never throws
 * — when the order is no longer OPEN by the time this runs (paid/cancelled
 * concurrently from another device, or already gone): the caller has no
 * other way to distinguish "actually added" from "safely rejected," since
 * both look identical as a resolved promise otherwise. This mirrors the
 * `{ orderId, unavailable }` result shape createWalkInOrder already uses for
 * the same reason — a defined result object instead of throwing for an
 * expected, recoverable outcome.
 */
export async function addItemToOrder(
  orderId: string,
  menuItemId: string,
  qty: number
): Promise<{ added: boolean }> {
  await requireStaff();
  if (!Number.isInteger(qty) || qty <= 0) return { added: false };

  const added = await prisma.$transaction(async (tx) => {
    // Row lock on the Order — see cancelOrder's doc comment below. Must be
    // the first statement so the OPEN check right after it can't race with
    // a concurrent cancelOrder for the same order.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const [order, menuItem] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId } }),
      tx.menuItem.findUnique({ where: { id: menuItemId } }),
    ]);
    if (!order || order.status !== "OPEN" || !menuItem) return false;

    const boundedQty = Math.min(qty, 50);
    const ok = await consumeStock(tx, menuItem, boundedQty);
    if (!ok) {
      throw new Error(`${menuItem.name} มีสต็อกไม่พอ (เหลือ ${menuItem.stock})`);
    }

    await tx.orderItem.create({
      data: {
        orderId,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        qty: boundedQty,
        status: "PENDING",
      },
    });
    return true;
  });

  revalidatePath("/pos");
  return { added };
}

export async function createWalkInOrder(
  type: "DINE_IN" | "TAKEAWAY",
  lines: { menuItemId: string; qty: number }[]
): Promise<{ orderId: string | null; unavailable: string[] }> {
  await requireStaff();
  const validLines = lines.filter((l) => Number.isInteger(l.qty) && l.qty > 0);
  if (validLines.length === 0) return { orderId: null, unavailable: [] };

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: validLines.map((l) => l.menuItemId) } },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));
  const unavailable: string[] = [];

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({ data: { type, status: "OPEN" } });

    for (const line of validLines) {
      const menuItem = menuItemById.get(line.menuItemId);
      if (!menuItem) continue;

      const qty = Math.min(line.qty, 50);
      const ok = await consumeStock(tx, menuItem, qty);
      if (!ok) {
        unavailable.push(menuItem.name);
        continue;
      }

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: menuItem.price,
          qty,
          status: "PENDING",
        },
      });
    }

    return order.id;
  });

  revalidatePath("/pos");
  return { orderId, unavailable };
}

export type PayOrderOptions = {
  /** Untrusted: validated at runtime against pricing.ts's PAYMENT_METHODS before use. Defaults to "CASH" so existing zero-arg callers keep working. */
  paymentMethod?: string;
  /** Satang tendered by the customer. Defaults to the computed grand total (exact payment, no change) when omitted. */
  paidAmount?: number;
  discount?: DiscountInput;
  /** Basis points (1 bp = 0.01%). Defaults to 0 (no service charge). */
  serviceChargeRateBasisPoints?: number;
  /** Basis points (1 bp = 0.01%). Defaults to 0 (no tax/VAT). */
  taxRateBasisPoints?: number;
};

/**
 * Charges an OPEN order and freezes its full pricing/payment breakdown onto
 * the Order row, matching src/lib/pricing.ts's formula. The grand total is
 * always computed here from the order's own OrderItem rows — a caller's
 * paidAmount is only ever validated against that server-computed total,
 * never trusted as the total itself.
 *
 * Concurrency: takes the same Order row lock (SELECT ... FOR UPDATE, as the
 * transaction's first statement) already used by cancelOrder/addItemToOrder,
 * so a concurrent pay/cancel/addItem for the same order always fully
 * serializes against this one — e.g. an addItemToOrder that loses the race
 * sees status no longer OPEN and is rejected, exactly as it already is
 * against a concurrent cancelOrder.
 *
 * Idempotency: if the order is already PAID, this is treated as a retry
 * (client timeout, a refresh, a duplicate click that got through the UI's
 * disable) and is a pure no-op — paidAt and every payment field are read
 * but never rewritten a second time. The atomic `updateMany` guard below is
 * a second line of defense on top of the row lock: only the call that
 * actually observes and flips OPEN -> PAID persists anything.
 */
export async function payOrder(orderId: string, options: PayOrderOptions = {}): Promise<void> {
  await requireStaff();

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) {
      throw new Error("ไม่พบออเดอร์นี้");
    }

    if (order.status === "PAID") {
      return;
    }
    if (order.status !== "OPEN") {
      throw new Error("ออเดอร์นี้ไม่สามารถชำระเงินได้ในสถานะปัจจุบัน");
    }

    const paymentMethodInput = options.paymentMethod ?? "CASH";
    if (!isPaymentMethod(paymentMethodInput)) {
      throw new Error("วิธีชำระเงินไม่ถูกต้อง");
    }
    const paymentMethod = paymentMethodInput;

    // Recomputed from the OrderItem rows actually committed in the DB —
    // never trusted from the caller — so a client can't under/over-state
    // what it owes.
    const subtotalAmount = order.items
      .filter((item) => item.status !== "CANCELLED")
      .reduce((sum, item) => sum + item.price * item.qty, 0);

    const pricing = computeOrderPricing({
      subtotalAmount,
      discount: options.discount,
      serviceChargeRateBasisPoints: options.serviceChargeRateBasisPoints,
      taxRateBasisPoints: options.taxRateBasisPoints,
    });

    const paidAmount = options.paidAmount ?? pricing.grandTotalAmount;
    const validation = validatePayment({
      paymentMethod,
      grandTotalAmount: pricing.grandTotalAmount,
      paidAmount,
    });
    if (!validation.ok) {
      throw new Error(validation.error);
    }

    // Atomic conditional update (same guard pattern as cancelOrder): only
    // the call that actually flips OPEN -> PAID here persists anything. The
    // row lock above already rules out a concurrent payOrder at this point,
    // but the guard is cheap, consistent with the rest of this file, and
    // correct if this ever races a status change added elsewhere later.
    const result = await tx.order.updateMany({
      where: { id: orderId, status: "OPEN" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod,
        subtotalAmount: pricing.subtotalAmount,
        discountAmount: pricing.discountAmount,
        serviceChargeRate: options.serviceChargeRateBasisPoints ?? 0,
        serviceChargeAmount: pricing.serviceChargeAmount,
        taxRate: options.taxRateBasisPoints ?? 0,
        taxAmount: pricing.taxAmount,
        grandTotalAmount: pricing.grandTotalAmount,
        paidAmount,
        changeAmount: validation.changeAmount,
      },
    });
    if (result.count === 0) {
      // Lost a race despite the lock above (shouldn't happen) — treat
      // exactly like the already-PAID retry case: no error, no mutation.
      return;
    }
  });

  revalidatePath("/pos");
  revalidatePath("/reports");
}

export async function cancelOrder(orderId: string): Promise<void> {
  await requireStaff();
  await prisma.$transaction(async (tx) => {
    // Row lock on the Order — the DB-level (not in-memory) lock that
    // serializes this against a concurrent addItemToOrder for the same
    // order, exactly like placeOrder's Table lock. Whichever transaction
    // gets here first runs to completion before the other's status
    // read/write proceeds, so we never end up with an item inserted after
    // (or "during") this cancellation.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    // Atomic conditional update (same pattern as consumeStock's guarded
    // updateMany in src/lib/stock.ts): only the call that actually flips the
    // order to CANCELLED proceeds to restore stock. A retried or duplicated
    // cancel request sees count === 0 and no-ops, so stock is never restored
    // twice.
    const result = await tx.order.updateMany({
      where: { id: orderId, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED" },
    });
    if (result.count === 0) return;

    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;

    for (const item of order.items) {
      if (item.status === "CANCELLED") continue;
      if (item.menuItemId) {
        await restoreStock(tx, item.menuItemId, item.qty, "ยกเลิกออเดอร์");
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "CANCELLED" } });
    }
  });
  revalidatePath("/pos");
}
