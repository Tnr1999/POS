"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type CartLine = { menuItemId: string; qty: number; note?: string };

export async function placeOrder(token: string, cart: CartLine[]) {
  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) {
    throw new Error("ไม่พบโต๊ะนี้ กรุณาสแกน QR code ใหม่อีกครั้ง");
  }

  const lines = cart.filter((line) => Number.isInteger(line.qty) && line.qty > 0);
  if (lines.length === 0) return;

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: lines.map((l) => l.menuItemId) }, active: true },
  });
  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  let order = await prisma.order.findFirst({
    where: { tableId: table.id, status: "OPEN" },
  });
  if (!order) {
    order = await prisma.order.create({
      data: { tableId: table.id, type: "DINE_IN", status: "OPEN" },
    });
  }

  const itemsToCreate = lines
    .map((line) => {
      const menuItem = menuItemById.get(line.menuItemId);
      if (!menuItem) return null;
      return {
        orderId: order!.id,
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        qty: Math.min(line.qty, 50),
        note: line.note?.slice(0, 200) || null,
        status: "PENDING",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (itemsToCreate.length === 0) return;

  await prisma.orderItem.createMany({ data: itemsToCreate });

  revalidatePath(`/order/${token}`);
  revalidatePath("/pos");
}
