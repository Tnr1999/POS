import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { placeOrder } from "@/app/order/[token]/actions";
import { openTableSession } from "@/app/(staff)/admin/tables/actions";

// Phase 2D.4: placeOrder's first argument is a TableSession token, not a
// Table.token — every fixture here opens a real ACTIVE session (via the
// production openTableSession action) and passes its token, matching how a
// customer's QR actually works post-migration.
describe("placeOrder concurrency + idempotency", () => {
  let tableId: string;
  let sessionToken: string;
  let menuItemId: string;

  beforeEach(async () => {
    const table = await prisma.table.create({
      data: { name: "Test Table", token: `tbl_${randomUUID()}` },
    });
    tableId = table.id;
    const opened = await openTableSession(tableId, randomUUID());
    sessionToken = opened.session.token;

    const menuItem = await prisma.menuItem.create({
      data: { name: "Test Dish", price: 5000, active: true, trackStock: true, stock: 10 },
    });
    menuItemId = menuItem.id;
  });

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { tableId } } });
    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.stockMovement.deleteMany({ where: { menuItemId } });
    await prisma.menuItem.delete({ where: { id: menuItemId } });
    await prisma.table.delete({ where: { id: tableId } }); // cascades the TableSession
  });

  it("does not create duplicate OPEN orders when two devices submit for the same session at once", async () => {
    const cart = [{ menuItemId, qty: 1 }];

    const [resultA, resultB] = await Promise.all([
      placeOrder(sessionToken, cart, randomUUID()),
      placeOrder(sessionToken, cart, randomUUID()),
    ]);

    expect(resultA.orderId).not.toBeNull();
    expect(resultB.orderId).toBe(resultA.orderId);

    const openOrders = await prisma.order.findMany({ where: { tableId, status: "OPEN" } });
    expect(openOrders).toHaveLength(1);

    const items = await prisma.orderItem.findMany({ where: { orderId: resultA.orderId! } });
    expect(items).toHaveLength(2); // one line from each of the two submissions

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(8); // 10 - 1 - 1
  });

  it("does not duplicate order items when the same submission is retried with the same idempotency key", async () => {
    const cart = [{ menuItemId, qty: 2 }];
    const idempotencyKey = randomUUID();

    const first = await placeOrder(sessionToken, cart, idempotencyKey);
    // Simulate a client retry after a timeout: identical call, same key.
    const retry = await placeOrder(sessionToken, cart, idempotencyKey);

    expect(retry.orderId).toBe(first.orderId);

    const items = await prisma.orderItem.findMany({ where: { orderId: first.orderId! } });
    expect(items).toHaveLength(1); // the retry must not insert a second line

    const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(menuItem.stock).toBe(8); // stock only consumed once, not twice
  });

  it("lets a genuinely new submission (different idempotency key) add its own items", async () => {
    const cart = [{ menuItemId, qty: 1 }];

    const first = await placeOrder(sessionToken, cart, randomUUID());
    const second = await placeOrder(sessionToken, cart, randomUUID());

    expect(second.orderId).toBe(first.orderId);

    const items = await prisma.orderItem.findMany({ where: { orderId: first.orderId! } });
    expect(items).toHaveLength(2);
  });

  it("rejects placeOrder for a token that was never a session (e.g. a bare Table.token) as expired", async () => {
    const bareTableToken = `tbl_${randomUUID()}`;
    await prisma.table.create({ data: { name: "Untouched", token: bareTableToken } });

    await expect(placeOrder(bareTableToken, [{ menuItemId, qty: 1 }], randomUUID())).rejects.toThrow(
      "QR นี้หมดอายุแล้ว"
    );

    await prisma.table.delete({ where: { token: bareTableToken } });
  });
});
