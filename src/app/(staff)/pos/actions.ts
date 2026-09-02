"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

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

  const [order, menuItem] = await Promise.all([
    prisma.order.findUnique({ where: { id: orderId } }),
    prisma.menuItem.findUnique({ where: { id: menuItemId } }),
  ]);
  if (!order || order.status !== "OPEN" || !menuItem) return;

  await prisma.orderItem.create({
    data: {
      orderId,
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty: Math.min(qty, 50),
      status: "PENDING",
    },
  });
  revalidatePath("/pos");
}

export async function createWalkInOrder(
  type: "DINE_IN" | "TAKEAWAY",
  lines: { menuItemId: string; qty: number }[]
): Promise<string | null> {
  await requireStaff();
  const validLines = lines.filter((l) => Number.isInteger(l.qty) && l.qty > 0);
  if (validLines.length === 0) return null;

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: validLines.map((l) => l.menuItemId) } },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  const order = await prisma.order.create({
    data: {
      type,
      status: "OPEN",
      items: {
        create: validLines
          .map((line) => {
            const menuItem = menuItemById.get(line.menuItemId);
            if (!menuItem) return null;
            return {
              menuItemId: menuItem.id,
              name: menuItem.name,
              price: menuItem.price,
              qty: Math.min(line.qty, 50),
              status: "PENDING",
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null),
      },
    },
  });

  revalidatePath("/pos");
  return order.id;
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
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/pos");
}
