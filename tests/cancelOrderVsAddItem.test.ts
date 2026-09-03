import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addItemToOrder, cancelOrder } from "@/app/(staff)/pos/actions";

describe("cancelOrder vs addItemToOrder race", () => {
  let orderId: string;
  let menuItemId: string;

  beforeEach(async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: `Test Dish ${randomUUID()}`, price: 5000, active: true, trackStock: true, stock: 10 },
    });
    menuItemId = menuItem.id;

    const order = await prisma.order.create({
      data: { type: "TAKEAWAY", status: "OPEN" },
    });
    orderId = order.id;
  });

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    await prisma.stockMovement.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.delete({ where: { id: menuItemId } });
  });

  it("addItemToOrder before cancelOrder: item is added, then cancel restores its stock", async () => {
    await addItemToOrder(orderId, menuItemId, 2);

    let menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(8); // consumed by the add

    await cancelOrder(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("CANCELLED");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].status).toBe("CANCELLED");

    menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(10); // restored back to the original amount
  });

  it("cancelOrder before addItemToOrder: add is rejected, no item and no stock consumed", async () => {
    await cancelOrder(orderId);

    await addItemToOrder(orderId, menuItemId, 2);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("CANCELLED");
    expect(order.items).toHaveLength(0); // addItemToOrder must not have inserted anything

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(10); // untouched
  });

  it("concurrent cancelOrder and addItemToOrder: never ends with a live item on a cancelled order, and stock stays consistent", async () => {
    await Promise.all([addItemToOrder(orderId, menuItemId, 2), cancelOrder(orderId)]);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("CANCELLED");

    // Whichever ran first, no OrderItem may be left in a non-CANCELLED state
    // on a CANCELLED order.
    for (const item of order.items) {
      expect(item.status).toBe("CANCELLED");
    }

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    // Never negative, and always back to the starting amount: either the add
    // never happened (rejected) or it happened and was fully restored.
    expect(menuItem.stock).toBeGreaterThanOrEqual(0);
    expect(menuItem.stock).toBe(10);
  });

  it("many concurrent addItemToOrder + cancelOrder attempts on the same order stay consistent", async () => {
    await Promise.all([
      addItemToOrder(orderId, menuItemId, 1),
      addItemToOrder(orderId, menuItemId, 1),
      cancelOrder(orderId),
      addItemToOrder(orderId, menuItemId, 1),
      cancelOrder(orderId),
    ]);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("CANCELLED");
    for (const item of order.items) {
      expect(item.status).toBe("CANCELLED");
    }

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBeGreaterThanOrEqual(0);
    expect(menuItem.stock).toBe(10); // every consumed unit must have been restored exactly once
  });
});

// Single-pair races can pass by luck even without the fix (the interleave
// window is narrow on a fast local DB - confirmed by reverting the Order row
// lock and observing this suite still pass sometimes). Running many
// independent order/item pairs concurrently gives the race many simultaneous
// chances to land, making this a reliable regression guard: reverting the
// lock in src/app/(staff)/pos/actions.ts makes this fail consistently
// (~50% of pairs violated when this was checked by hand), while the fix
// brings it to zero every time.
describe("cancelOrder vs addItemToOrder race (amplified)", () => {
  it("many parallel order/cancel pairs never leave a live item on a cancelled order or lose/duplicate stock restoration", async () => {
    const PAIRS = 40;
    const fixtures = await Promise.all(
      Array.from({ length: PAIRS }, async () => {
        const menuItem = await prisma.menuItem.create({
          data: { name: `Test Dish ${randomUUID()}`, price: 100, active: true, trackStock: true, stock: 10 },
        });
        const order = await prisma.order.create({ data: { type: "TAKEAWAY", status: "OPEN" } });
        return { menuItemId: menuItem.id, orderId: order.id };
      })
    );

    try {
      await Promise.all(
        fixtures.flatMap(({ orderId: oid, menuItemId: mid }) => [
          addItemToOrder(oid, mid, 2),
          cancelOrder(oid),
        ])
      );

      for (const { orderId: oid, menuItemId: mid } of fixtures) {
        const order = await prisma.order.findUniqueOrThrow({ where: { id: oid }, include: { items: true } });
        expect(order.status).toBe("CANCELLED");
        for (const item of order.items) {
          expect(item.status).toBe("CANCELLED");
        }

        const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: mid } });
        expect(menuItem.stock).toBeGreaterThanOrEqual(0);
        expect(menuItem.stock).toBe(10); // fully restored whether or not the add "won" the race
      }
    } finally {
      const orderIds = fixtures.map((f) => f.orderId);
      const menuItemIds = fixtures.map((f) => f.menuItemId);
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
      await prisma.stockMovement.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
      await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
    }
  });
});
