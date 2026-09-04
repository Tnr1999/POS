import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addItemToOrder, cancelOrder } from "@/app/(staff)/pos/actions";

describe("addItemToOrder result contract", () => {
  let orderId: string;
  let menuItemId: string;

  beforeEach(async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: `Test Dish ${randomUUID()}`, price: 5000, active: true, trackStock: false },
    });
    menuItemId = menuItem.id;

    const order = await prisma.order.create({ data: { type: "TAKEAWAY", status: "OPEN" } });
    orderId = order.id;
  });

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
  });

  it("OPEN order: the item is actually inserted and the caller is told added: true", async () => {
    const result = await addItemToOrder(orderId, menuItemId, 2);
    expect(result).toEqual({ added: true });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].qty).toBe(2);
  });

  it("non-OPEN order (CANCELLED): nothing is inserted and the caller is told added: false", async () => {
    await cancelOrder(orderId);

    const result = await addItemToOrder(orderId, menuItemId, 2);
    expect(result).toEqual({ added: false });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.items).toHaveLength(0); // nothing landed on the cancelled order
  });

  it("invalid qty (<= 0): rejected with added: false, no transaction, no insert", async () => {
    const result = await addItemToOrder(orderId, menuItemId, 0);
    expect(result).toEqual({ added: false });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.items).toHaveLength(0);
  });

  it("concurrent addItemToOrder + cancelOrder: whichever one actually wins, the caller can always tell from the result — never a silent, ambiguous success", async () => {
    const [result] = await Promise.all([addItemToOrder(orderId, menuItemId, 1), cancelOrder(orderId)]);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    // Whichever call actually acquired the row lock first, the order always
    // ends up CANCELLED (cancelOrder never backs off) — the distinguishing
    // fact is only visible through addItemToOrder's own return value:
    if (result.added) {
      // addItemToOrder won the race and inserted before the cancellation;
      // cancelOrder's own sweep then marks that item CANCELLED too, but it
      // was genuinely added — no duplicate insertion, exactly one row.
      expect(order.items).toHaveLength(1);
      expect(order.items[0].status).toBe("CANCELLED");
    } else {
      // cancelOrder won: nothing was ever inserted, and the caller correctly
      // knows this from added: false rather than assuming success.
      expect(order.items).toHaveLength(0);
    }
    expect(order.status).toBe("CANCELLED");
  });
});
