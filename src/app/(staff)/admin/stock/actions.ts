"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function restockItem(formData: FormData) {
  await requireStaff();
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const qty = Math.trunc(Number(formData.get("qty")));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  if (!menuItemId || !Number.isFinite(qty) || qty === 0) return;

  await prisma.$transaction(async (tx) => {
    const menuItem = await tx.menuItem.findUnique({ where: { id: menuItemId } });
    if (!menuItem) return;

    const newStock = Math.max(0, menuItem.stock + qty);
    const actualChange = newStock - menuItem.stock;
    if (actualChange === 0) return;

    await tx.menuItem.update({ where: { id: menuItemId }, data: { stock: newStock } });
    await tx.stockMovement.create({
      data: {
        menuItemId,
        type: "RESTOCK",
        qtyChange: actualChange,
        note,
      },
    });
  });

  revalidatePath("/admin/stock");
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}
