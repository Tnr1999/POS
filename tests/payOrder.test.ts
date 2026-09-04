import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addItemToOrder, cancelOrder, payOrder } from "@/app/(staff)/pos/actions";

const UNIT_PRICE = 10000; // 100.00 THB in satang
const INITIAL_QTY = 2; // initial line: 200.00 THB subtotal

async function createFixture() {
  const menuItem = await prisma.menuItem.create({
    data: { name: `Test Dish ${randomUUID()}`, price: UNIT_PRICE, active: true, trackStock: true, stock: 20 },
  });
  const order = await prisma.order.create({
    data: {
      type: "TAKEAWAY",
      status: "OPEN",
      items: {
        create: {
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: UNIT_PRICE,
          qty: INITIAL_QTY,
          status: "PENDING",
        },
      },
    },
  });
  await prisma.menuItem.update({ where: { id: menuItem.id }, data: { stock: { decrement: INITIAL_QTY } } });
  return { orderId: order.id, menuItemId: menuItem.id };
}

async function cleanupFixture(orderId: string, menuItemId: string) {
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  await prisma.stockMovement.deleteMany({ where: { menuItemId } });
  await prisma.menuItem.delete({ where: { id: menuItemId } });
}

describe("payOrder", () => {
  let orderId: string;
  let menuItemId: string;

  beforeEach(async () => {
    ({ orderId, menuItemId } = await createFixture());
  });

  afterEach(async () => {
    await cleanupFixture(orderId, menuItemId);
  });

  it("charges the subtotal exactly, defaulting to CASH with exact change when no options are given", async () => {
    await payOrder(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
    expect(order.paymentMethod).toBe("CASH");
    expect(order.subtotalAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.discountAmount).toBe(0);
    expect(order.serviceChargeAmount).toBe(0);
    expect(order.taxAmount).toBe(0);
    expect(order.grandTotalAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.paidAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.changeAmount).toBe(0);
    expect(order.paidAt).not.toBeNull();
  });

  it("snapshots discount/service charge/tax amounts and rates from server-side pricing, not the client", async () => {
    await payOrder(orderId, {
      paymentMethod: "CASH",
      discount: { type: "AMOUNT", amountSatang: 2000 },
      serviceChargeRateBasisPoints: 1000, // 10%
      taxRateBasisPoints: 700, // 7%
      paidAmount: 200000, // overpay to get change
    });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const subtotal = UNIT_PRICE * INITIAL_QTY; // 20000
    const afterDiscount = subtotal - 2000; // 18000
    const serviceCharge = Math.round(afterDiscount * 0.1); // 1800
    const afterService = afterDiscount + serviceCharge; // 19800
    const tax = Math.round(afterService * 0.07); // 1386
    const grandTotal = afterService + tax; // 21186

    expect(order.subtotalAmount).toBe(subtotal);
    expect(order.discountAmount).toBe(2000);
    expect(order.serviceChargeRate).toBe(1000);
    expect(order.serviceChargeAmount).toBe(serviceCharge);
    expect(order.taxRate).toBe(700);
    expect(order.taxAmount).toBe(tax);
    expect(order.grandTotalAmount).toBe(grandTotal);
    expect(order.paidAmount).toBe(200000);
    expect(order.changeAmount).toBe(200000 - grandTotal);
  });

  it("rejects a client-supplied grand total: only the server-recomputed pricing is ever persisted", async () => {
    // No way to pass a client "grandTotal" at all — payOrder only accepts
    // inputs that feed the server-side pricing function. Confirm the stored
    // grandTotal always matches what the server computes from DB items,
    // never anything else.
    await payOrder(orderId, { paymentMethod: "QR_PAYMENT", paidAmount: UNIT_PRICE * INITIAL_QTY });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.grandTotalAmount).toBe(UNIT_PRICE * INITIAL_QTY);
  });

  it("invalid paymentMethod is rejected and mutates nothing", async () => {
    await expect(payOrder(orderId, { paymentMethod: "BITCOIN" })).rejects.toThrow();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("OPEN");
    expect(order.paymentMethod).toBeNull();
    expect(order.paidAt).toBeNull();
  });

  it("CASH: paidAmount below the grand total is rejected and mutates nothing", async () => {
    const grandTotal = UNIT_PRICE * INITIAL_QTY;
    await expect(payOrder(orderId, { paymentMethod: "CASH", paidAmount: grandTotal - 1 })).rejects.toThrow();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("OPEN");
    expect(order.grandTotalAmount).toBeNull();
    expect(order.paidAt).toBeNull();
  });

  it("QR_PAYMENT: paidAmount not exactly matching the grand total is rejected and mutates nothing", async () => {
    const grandTotal = UNIT_PRICE * INITIAL_QTY;
    await expect(
      payOrder(orderId, { paymentMethod: "QR_PAYMENT", paidAmount: grandTotal + 1 })
    ).rejects.toThrow();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("OPEN");
    expect(order.grandTotalAmount).toBeNull();
  });

  it("rejects paying an order that has already been CANCELLED", async () => {
    await cancelOrder(orderId);
    await expect(payOrder(orderId)).rejects.toThrow();

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentMethod).toBeNull();
  });

  it("retry after success: paidAt and every payment field are frozen, even if the retry sends different options", async () => {
    await payOrder(orderId, { paymentMethod: "CASH", paidAmount: UNIT_PRICE * INITIAL_QTY });
    const first = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    // A retry (timeout/refresh/duplicate click) arriving with *different*
    // inputs must still be a total no-op - it must not be possible to
    // "re-pay" an order with a different method or amount after the fact.
    await payOrder(orderId, {
      paymentMethod: "QR_PAYMENT",
      paidAmount: 999999,
      discount: { type: "AMOUNT", amountSatang: 5000 },
    });
    const retried = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    expect(retried.paidAt?.getTime()).toBe(first.paidAt?.getTime());
    expect(retried.paymentMethod).toBe(first.paymentMethod);
    expect(retried.subtotalAmount).toBe(first.subtotalAmount);
    expect(retried.discountAmount).toBe(first.discountAmount);
    expect(retried.grandTotalAmount).toBe(first.grandTotalAmount);
    expect(retried.paidAmount).toBe(first.paidAmount);
    expect(retried.changeAmount).toBe(first.changeAmount);
  });

  it("paying twice concurrently (double-submit) results in exactly one recorded payment", async () => {
    const results = await Promise.allSettled([
      payOrder(orderId, { paymentMethod: "CASH", paidAmount: UNIT_PRICE * INITIAL_QTY }),
      payOrder(orderId, { paymentMethod: "CASH", paidAmount: UNIT_PRICE * INITIAL_QTY }),
    ]);
    // Neither call should throw: whichever loses the race just sees
    // status===PAID already and no-ops.
    for (const r of results) expect(r.status).toBe("fulfilled");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
    expect(order.subtotalAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.grandTotalAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.paidAmount).toBe(UNIT_PRICE * INITIAL_QTY);
    expect(order.changeAmount).toBe(0);
  });

  it("addItemToOrder before payOrder: the added item is included in what gets charged", async () => {
    await addItemToOrder(orderId, menuItemId, 1);
    await payOrder(orderId);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.items).toHaveLength(2);
    expect(order.subtotalAmount).toBe(UNIT_PRICE * (INITIAL_QTY + 1));
    expect(order.grandTotalAmount).toBe(UNIT_PRICE * (INITIAL_QTY + 1));
  });

  it("payOrder before addItemToOrder: the add is rejected and never reaches the paid order", async () => {
    await payOrder(orderId);
    await expect(addItemToOrder(orderId, menuItemId, 1)).resolves.toEqual({ added: false }); // rejected, not thrown, for a non-OPEN order — the caller can tell it didn't happen

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.items).toHaveLength(1); // no new item landed on the PAID order
    expect(order.status).toBe("PAID");
  });

  it("concurrent payOrder + addItemToOrder: the paid snapshot always matches exactly the items present, whichever order won", async () => {
    const results = await Promise.allSettled([
      payOrder(orderId, { paymentMethod: "CASH" }),
      addItemToOrder(orderId, menuItemId, 1),
    ]);
    for (const r of results) expect(r.status).toBe("fulfilled"); // addItemToOrder never throws for a non-OPEN order, it just no-ops

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("PAID");

    const actualSubtotal = order.items
      .filter((i) => i.status !== "CANCELLED")
      .reduce((sum, i) => sum + i.price * i.qty, 0);
    // Whichever ran first, the frozen subtotal must equal exactly the items
    // that existed at payment time - never more (an item added afterward)
    // nor less (an item present but excluded).
    expect(order.subtotalAmount).toBe(actualSubtotal);
    expect(order.grandTotalAmount).toBe(actualSubtotal);
  });

  it("concurrent addItemToOrder + payOrder (reversed call order): same invariant holds", async () => {
    const results = await Promise.allSettled([
      addItemToOrder(orderId, menuItemId, 1),
      payOrder(orderId, { paymentMethod: "CASH" }),
    ]);
    for (const r of results) expect(r.status).toBe("fulfilled");

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    expect(order.status).toBe("PAID");

    const actualSubtotal = order.items
      .filter((i) => i.status !== "CANCELLED")
      .reduce((sum, i) => sum + i.price * i.qty, 0);
    expect(order.subtotalAmount).toBe(actualSubtotal);
    expect(order.grandTotalAmount).toBe(actualSubtotal);
  });

  it("payOrder never consumes or restores stock — it only charges for what was already committed", async () => {
    const before = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    await payOrder(orderId);
    const after = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItemId } });
    expect(after.stock).toBe(before.stock);
  });
});

// Single-pair races can pass by luck even with a real bug (the interleave
// window is narrow on a fast local DB - this was confirmed by hand for the
// analogous cancelOrder/addItemToOrder race in tests/cancelOrderVsAddItem.test.ts).
// Running many independent order fixtures concurrently, each hit with a
// double-pay *and* a racing addItemToOrder, gives every kind of violation
// many simultaneous chances to land.
describe("payOrder concurrency (amplified)", () => {
  it("many parallel fixtures under double-pay + racing addItem never double-charge, double-consume stock, or add an item to a paid order", async () => {
    const PAIRS = 30;
    const fixtures = await Promise.all(Array.from({ length: PAIRS }, () => createFixture()));

    try {
      await Promise.all(
        fixtures.flatMap(({ orderId: oid, menuItemId: mid }) => [
          payOrder(oid, { paymentMethod: "CASH" }).catch(() => {}),
          payOrder(oid, { paymentMethod: "CASH" }).catch(() => {}),
          addItemToOrder(oid, mid, 1).catch(() => {}),
        ])
      );

      for (const { orderId: oid, menuItemId: mid } of fixtures) {
        const order = await prisma.order.findUniqueOrThrow({ where: { id: oid }, include: { items: true } });
        expect(order.status).toBe("PAID");

        const actualSubtotal = order.items
          .filter((i) => i.status !== "CANCELLED")
          .reduce((sum, i) => sum + i.price * i.qty, 0);
        // Snapshot taken exactly once, matching exactly the items present at
        // that moment - never double-counted, never missing/extra.
        expect(order.subtotalAmount).toBe(actualSubtotal);
        expect(order.grandTotalAmount).toBe(actualSubtotal);
        expect(order.paidAmount).toBe(actualSubtotal);
        expect(order.changeAmount).toBe(0);

        const menuItem = await prisma.menuItem.findUniqueOrThrow({ where: { id: mid } });
        const consumedQty = order.items.reduce((sum, i) => sum + i.qty, 0);
        // Stock only ever consumed once per item, by addItemToOrder/the
        // initial fixture insert - paying never touches it.
        expect(menuItem.stock).toBe(20 - consumedQty);
        expect(menuItem.stock).toBeGreaterThanOrEqual(0);
      }
    } finally {
      for (const { orderId: oid, menuItemId: mid } of fixtures) {
        await cleanupFixture(oid, mid);
      }
    }
  });
});
