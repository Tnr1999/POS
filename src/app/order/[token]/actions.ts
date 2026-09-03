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

export async function placeOrder(token: string, cart: CartLine[]): Promise<PlaceOrderResult> {
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
    let order = await tx.order.findFirst({
      where: { tableId: table.id, status: "OPEN" },
    });
    if (!order) {
      order = await tx.order.create({
        data: { tableId: table.id, type: "DINE_IN", status: "OPEN" },
      });
    }
    orderId = order.id;

    for (const line of lines) {
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
        },
      });
    }
  });

  revalidatePath(`/order/${token}`);
  revalidatePath("/pos");

  return { unavailable, orderId };
}
