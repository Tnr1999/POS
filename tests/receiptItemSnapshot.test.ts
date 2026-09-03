import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// The receipt page (src/app/receipt/[orderId]/page.tsx) renders item lines
// straight from OrderItem.name/price/qty, never re-joining MenuItem — this
// confirms that invariant holds at the data level: even after a MenuItem's
// current name/price changes, a previously-created OrderItem row (what the
// receipt actually reads) is untouched.
describe("receipt item snapshot (integration)", () => {
  let orderId: string;
  let menuItemId: string;

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.menuItem.deleteMany({ where: { id: menuItemId } });
  });

  it("OrderItem price/name stay frozen even after the MenuItem's current price and name change", async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: `Original Name ${randomUUID()}`, price: 5000, active: true },
    });
    menuItemId = menuItem.id;

    const order = await prisma.order.create({
      data: {
        type: "TAKEAWAY",
        status: "PAID",
        paidAt: new Date(),
        items: {
          create: { menuItemId: menuItem.id, name: menuItem.name, price: 5000, qty: 2, status: "SERVED" },
        },
      },
    });
    orderId = order.id;

    // Simulate the menu changing after the order was placed and paid —
    // e.g. the shop raises the price and renames the dish later.
    await prisma.menuItem.update({
      where: { id: menuItem.id },
      data: { name: "Renamed Dish", price: 9999 },
    });

    const receiptOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });

    expect(receiptOrder.items).toHaveLength(1);
    expect(receiptOrder.items[0].name).toBe(menuItem.name); // original name, not "Renamed Dish"
    expect(receiptOrder.items[0].price).toBe(5000); // original price, not 9999
  });
});
