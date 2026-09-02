import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Atomically decrements stock for a menu item, only if enough is available.
 * The WHERE clause's `stock: { gte: qty }` makes the check-and-decrement a
 * single DB statement, so two concurrent orders can't both succeed off the
 * same last unit. Returns false (and makes no change) if stock is
 * insufficient or the item no longer exists. Items that don't track stock
 * always succeed without touching the stock column.
 */
export async function consumeStock(
  tx: Tx,
  menuItem: { id: string; trackStock: boolean },
  qty: number
): Promise<boolean> {
  if (!menuItem.trackStock) return true;

  const result = await tx.menuItem.updateMany({
    where: { id: menuItem.id, stock: { gte: qty } },
    data: { stock: { decrement: qty } },
  });
  if (result.count === 0) return false;

  await tx.stockMovement.create({
    data: { menuItemId: menuItem.id, type: "SALE", qtyChange: -qty },
  });
  return true;
}

/** Adds stock back for a cancelled order/item that had consumed it. */
export async function restoreStock(
  tx: Tx,
  menuItemId: string,
  qty: number,
  note?: string
): Promise<void> {
  const menuItem = await tx.menuItem.findUnique({ where: { id: menuItemId } });
  if (!menuItem || !menuItem.trackStock) return;

  await tx.menuItem.update({
    where: { id: menuItemId },
    data: { stock: { increment: qty } },
  });
  await tx.stockMovement.create({
    data: { menuItemId, type: "RESTORE", qtyChange: qty, note },
  });
}
