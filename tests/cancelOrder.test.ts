import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOrder } from "@/app/(staff)/pos/actions";

describe("cancelOrder idempotency", () => {
  let orderId: string;
  let menuItemId: string;

  beforeEach(async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: `Test Dish ${randomUUID()}`, price: 5000, active: true, trackStock: true, stock: 10 },
    });
    menuItemId = menuItem.id;

    const order = await prisma.order.create({
      data: {
        type: "TAKEAWAY",
        status: "OPEN",
        items: {
          create: { menuItemId, name: menuItem.name, price: menuItem.price, qty: 3, status: "PENDING" },
        },
      },
    });
    orderId = order.id;
    // Mirror what placeOrder/addItemToOrder would have done: consume the stock
    // up front, so cancelling is expected to restore it.
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { stock: { decrement: 3 } } });
  });

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    await prisma.stockMovement.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.delete({ where: { id: menuItemId } });
  });

  it("does not restore stock twice when the same order is cancelled twice", async () => {
    await cancelOrder(orderId);
    await cancelOrder(orderId); // e.g. a duplicated click / retried request

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(10); // restored once, not twice

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("CANCELLED");
    expect(order.items.every((i) => i.status === "CANCELLED")).toBe(true);
  });

  it("does not restore stock twice when two cancel requests race for the same order", async () => {
    await Promise.all([cancelOrder(orderId), cancelOrder(orderId)]);

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(10);
  });
});
