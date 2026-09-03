import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resolveOrderTotals } from "@/lib/orderTotals";

// Exercises the same query shape and per-order resolveOrderTotals() usage
// that src/app/(staff)/reports/page.tsx's ReportsData relies on, against
// real seeded rows in the dev Postgres. ReportsData itself is an unexported
// async Server Component, so these validate the data-shaping logic it's
// built on rather than rendering it — see also tests/orderTotals.test.ts
// for the pure per-order cases this composes.
//
// Every assertion below is scoped to this test's own seeded order id/ids,
// never a whole-table count or an unscoped date-range query — vitest runs
// test files in parallel against the same shared dev DB, so a global
// aggregate would race against other files' concurrently-created fixtures.
describe("reports revenue source-of-truth (integration)", () => {
  const createdOrderIds: string[] = [];
  const createdMenuItemIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: createdMenuItemIds } } });
    createdOrderIds.length = 0;
    createdMenuItemIds.length = 0;
  });

  async function seedMenuItem(price: number) {
    const menuItem = await prisma.menuItem.create({
      data: { name: `Test ${randomUUID()}`, price, active: true },
    });
    createdMenuItemIds.push(menuItem.id);
    return menuItem;
  }

  async function seedOrder(data: Parameters<typeof prisma.order.create>[0]["data"]) {
    const order = await prisma.order.create({ data });
    createdOrderIds.push(order.id);
    return order;
  }

  it("counts a snapshot PAID order using grandTotalAmount, not the item sum", async () => {
    const menuItem = await seedMenuItem(10000);
    const order = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: new Date(),
      // Deliberately mismatched from the snapshot to prove grandTotalAmount wins.
      subtotalAmount: 999999,
      grandTotalAmount: 15000,
      paymentMethod: "CASH",
      paidAmount: 15000,
      changeAmount: 0,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 3, status: "SERVED" } },
    });

    const single = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(resolveOrderTotals(single).grandTotalAmount).toBe(15000);
  });

  it("counts a legacy PAID order (no snapshot) using the item sum", async () => {
    const menuItem = await seedMenuItem(5000);
    const now = new Date();
    const order = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: now,
      // No payment snapshot fields set at all - matches pre-Phase-2A data.
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 5000, qty: 2, status: "SERVED" } },
    });

    const single = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    const totals = resolveOrderTotals(single);
    expect(totals.source).toBe("legacy");
    expect(totals.grandTotalAmount).toBe(10000);
    expect(totals.paymentMethod).toBeNull();
  });

  it("excludes a CANCELLED order from revenue entirely, even though it has OrderItems", async () => {
    const menuItem = await seedMenuItem(10000);
    const cancelled = await seedOrder({
      type: "TAKEAWAY",
      status: "CANCELLED",
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 5, status: "CANCELLED" } },
    });

    // Scoped to this exact order id (not a whole-table count, which would
    // race against other test files' concurrently-running fixtures on the
    // same shared dev DB): reports' query filters status: "PAID", and a
    // CANCELLED order can never satisfy that, for any date range.
    const matched = await prisma.order.findFirst({ where: { id: cancelled.id, status: "PAID" } });
    expect(matched).toBeNull();

    // Confirm the order really does exist (as CANCELLED) — otherwise a
    // vacuous pass (e.g. the seed silently failing) would look identical.
    const stillExists = await prisma.order.findUnique({ where: { id: cancelled.id } });
    expect(stillExists?.status).toBe("CANCELLED");
  });

  it("uses paidAt for date-range membership, not createdAt", async () => {
    const menuItem = await seedMenuItem(10000);
    const oldCreatedAt = new Date("2020-01-01T00:00:00Z");
    const recentPaidAt = new Date();
    const order = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      createdAt: oldCreatedAt,
      paidAt: recentPaidAt,
      grandTotalAmount: 10000,
      subtotalAmount: 10000,
      paymentMethod: "CASH",
      paidAmount: 10000,
      changeAmount: 0,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 1, status: "SERVED" } },
    });

    // A range that covers "now" (paidAt) but not 2020 (createdAt) must still
    // include this order.
    const from = new Date(recentPaidAt.getTime() - 60_000);
    const to = new Date(recentPaidAt.getTime() + 60_000);
    const matched = await prisma.order.findFirst({ where: { id: order.id, paidAt: { gte: from, lte: to } } });
    expect(matched).not.toBeNull();

    // A range around the old createdAt must NOT match, proving createdAt is
    // not what's being filtered on.
    const oldFrom = new Date(oldCreatedAt.getTime() - 60_000);
    const oldTo = new Date(oldCreatedAt.getTime() + 60_000);
    const notMatched = await prisma.order.findFirst({ where: { id: order.id, paidAt: { gte: oldFrom, lte: oldTo } } });
    expect(notMatched).toBeNull();
  });

  it("a CASH overpayment's revenue is the grand total, never the tendered paidAmount", async () => {
    const menuItem = await seedMenuItem(18000);
    const order = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: new Date(),
      subtotalAmount: 18000,
      grandTotalAmount: 18000,
      paymentMethod: "CASH",
      paidAmount: 20000, // customer handed over more
      changeAmount: 2000,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 18000, qty: 1, status: "SERVED" } },
    });

    const single = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    const totals = resolveOrderTotals(single);
    expect(totals.grandTotalAmount).toBe(18000);
    expect(totals.paidAmount).toBe(20000);
    // The two must never be conflated as revenue.
    expect(totals.grandTotalAmount).not.toBe(totals.paidAmount);
  });

  it("CASH and QR_PAYMENT orders keep distinct payment methods, and legacy NULL is never coerced to CASH", async () => {
    const menuItem = await seedMenuItem(10000);
    const now = new Date();
    const cash = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: now,
      grandTotalAmount: 10000,
      subtotalAmount: 10000,
      paymentMethod: "CASH",
      paidAmount: 10000,
      changeAmount: 0,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 1, status: "SERVED" } },
    });
    const qr = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: now,
      grandTotalAmount: 10000,
      subtotalAmount: 10000,
      paymentMethod: "QR_PAYMENT",
      paidAmount: 10000,
      changeAmount: 0,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 1, status: "SERVED" } },
    });
    const legacy = await seedOrder({
      type: "TAKEAWAY",
      status: "PAID",
      paidAt: now,
      items: { create: { menuItemId: menuItem.id, name: menuItem.name, price: 10000, qty: 1, status: "SERVED" } },
    });

    const [cashOrder, qrOrder, legacyOrder] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: cash.id }, include: { items: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: qr.id }, include: { items: true } }),
      prisma.order.findUniqueOrThrow({ where: { id: legacy.id }, include: { items: true } }),
    ]);

    expect(resolveOrderTotals(cashOrder).paymentMethod).toBe("CASH");
    expect(resolveOrderTotals(qrOrder).paymentMethod).toBe("QR_PAYMENT");
    expect(resolveOrderTotals(legacyOrder).paymentMethod).toBeNull();
  });
});
