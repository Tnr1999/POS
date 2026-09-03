"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { consumeStock, restoreStock } from "@/lib/stock";

const ITEM_STATUS_ORDER = ["PENDING", "PREPARING", "SERVED"];

export async function advanceOrderItemStatus(orderItemId: string) {
  await requireStaff();
  const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
  if (!item) return;

  const currentIndex = ITEM_STATUS_ORDER.indexOf(item.status);
  const next = ITEM_STATUS_ORDER[currentIndex + 1];
  if (!next) return;

  await prisma.orderItem.update({ where: { id: orderItemId }, data: { status: next } });
  revalidatePath("/pos");
}

export async function addItemToOrder(orderId: string, menuItemId: string, qty: number) {
  await requireStaff();
  if (!Number.isInteger(qty) || qty <= 0) return;

  await prisma.$transaction(async (tx) => {
    const [order, menuItem] = await Promise.all([
      tx.order.findUnique({ where: { id: orderId } }),
      tx.menuItem.findUnique({ where: { id: menuItemId } }),
    ]);
    if (!order || order.status !== "OPEN" || !menuItem) return;

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
  });
  revalidatePath("/pos");
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

export async function payOrder(orderId: string): Promise<void> {
  await requireStaff();
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "PAID", paidAt: new Date() },
  });
  revalidatePath("/pos");
  revalidatePath("/reports");
}

export async function cancelOrder(orderId: string): Promise<void> {
  await requireStaff();
  await prisma.$transaction(async (tx) => {
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
