import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeTableSession, openTableSession } from "@/app/(staff)/admin/tables/actions";
import { placeOrder, type CartLine } from "@/app/order/[token]/actions";
import { payOrder } from "@/app/(staff)/pos/actions";
import { resolveActiveSessionByToken } from "@/lib/tableSessionAccess";

// Phase 2D.5 — production-readiness verification. The audit for this phase
// found the lifecycle already correct (see final report); these tests exist
// to prove the full real-world narrative end to end in one place, and to
// cover the one race combination (closeTableSession vs payOrder) that
// wasn't already exercised by Phase 2D.4's tests.
describe("Phase 2D.5 — full lifecycle: two devices, pay, close, reopen, isolation", () => {
  let tableIds: string[] = [];
  let menuItemIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIds } } } });
    await prisma.order.deleteMany({ where: { tableId: { in: tableIds } } });
    await prisma.stockMovement.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
    await prisma.table.deleteMany({ where: { id: { in: tableIds } } }); // cascades TableSessions
    tableIds = [];
    menuItemIds = [];
  });

  async function fixtureTable() {
    const table = await prisma.table.create({ data: { name: `E2E ${randomUUID()}`, token: `tbl_${randomUUID()}` } });
    tableIds.push(table.id);
    return table;
  }

  async function fixtureMenuItem(stock = 50) {
    const item = await prisma.menuItem.create({
      data: { name: `E2E Dish ${randomUUID()}`, price: 2000, active: true, trackStock: true, stock },
    });
    menuItemIds.push(item.id);
    return item;
  }

  it("runs the full 13-step narrative with a clean session boundary at every step", async () => {
    const table = await fixtureTable();
    const menuItem = await fixtureMenuItem();
    const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

    // 1. Open session S1 for table T1.
    const s1 = await openTableSession(table.id, randomUUID());
    expect(s1.session.status).toBe("ACTIVE");

    // 2 & 3. Device A and Device B both "open" S1 (resolve the same token).
    const accessA = await resolveActiveSessionByToken(s1.session.token);
    const accessB = await resolveActiveSessionByToken(s1.session.token);
    expect(accessA!.sessionId).toBe(s1.session.id);
    expect(accessB!.sessionId).toBe(s1.session.id);

    // 4. Device A places an item.
    const fromA = await placeOrder(s1.session.token, cart, randomUUID());
    expect(fromA.orderId).not.toBeNull();

    // 5. Device B sees/uses the same OPEN order.
    const orderForB = await prisma.order.findFirst({ where: { tableSessionId: s1.session.id, status: "OPEN" } });
    expect(orderForB!.id).toBe(fromA.orderId);

    // 6. Device B places another item (same session token -> same order).
    const fromB = await placeOrder(s1.session.token, cart, randomUUID());
    expect(fromB.orderId).toBe(fromA.orderId);

    // 7. Exactly one OPEN order for S1/table T1.
    const openOrdersForS1 = await prisma.order.findMany({ where: { tableSessionId: s1.session.id, status: "OPEN" } });
    expect(openOrdersForS1).toHaveLength(1);
    const items = await prisma.orderItem.findMany({ where: { orderId: fromA.orderId! } });
    expect(items).toHaveLength(2); // both devices' items landed on the one order

    // 8. Pay the order.
    await payOrder(fromA.orderId!);
    const paid = await prisma.order.findUniqueOrThrow({ where: { id: fromA.orderId! } });
    expect(paid.status).toBe("PAID");

    // 9. Close S1.
    const closed = await closeTableSession(s1.session.id);
    expect(closed.success).toBe(true);
    expect(closed.session.status).toBe("CLOSED");

    // 10. Open S2 (new round on the same physical table).
    const s2 = await openTableSession(table.id, randomUUID());
    expect(s2.session.status).toBe("ACTIVE");
    expect(s2.session.token).not.toBe(s1.session.token);
    expect(s2.session.id).not.toBe(s1.session.id);

    // 11. A device using the S1 token must be rejected.
    expect(await resolveActiveSessionByToken(s1.session.token)).toBeNull();
    await expect(placeOrder(s1.session.token, cart, randomUUID())).rejects.toThrow("QR นี้หมดอายุแล้ว");

    // 12. A device using the S2 token must create/use a new order.
    const fromS2 = await placeOrder(s2.session.token, cart, randomUUID());
    expect(fromS2.orderId).not.toBeNull();
    expect(fromS2.orderId).not.toBe(fromA.orderId);

    // 13. S1's (paid) order must never appear as the current order for S2.
    const currentUnderS2 = await prisma.order.findFirst({ where: { tableSessionId: s2.session.id, status: "OPEN" } });
    expect(currentUnderS2!.id).toBe(fromS2.orderId);
    expect(currentUnderS2!.id).not.toBe(fromA.orderId);
    const s1OrderStillPaid = await prisma.order.findUniqueOrThrow({ where: { id: fromA.orderId! } });
    expect(s1OrderStillPaid.tableSessionId).toBe(s1.session.id); // never reattached to S2
    expect(s1OrderStillPaid.status).toBe("PAID"); // untouched by everything after step 8
  });
});

describe("Phase 2D.5 — closeTableSession vs payOrder race", () => {
  let tableIds: string[] = [];
  let menuItemIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIds } } } });
    await prisma.order.deleteMany({ where: { tableId: { in: tableIds } } });
    await prisma.stockMovement.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
    await prisma.table.deleteMany({ where: { id: { in: tableIds } } });
    tableIds = [];
    menuItemIds = [];
  });

  async function fixture() {
    const table = await prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `tbl_${randomUUID()}` } });
    tableIds.push(table.id);
    const menuItem = await prisma.menuItem.create({
      data: { name: `Race Dish ${randomUUID()}`, price: 1000, active: true, trackStock: true, stock: 50 },
    });
    menuItemIds.push(menuItem.id);
    const opened = await openTableSession(table.id, randomUUID());
    const placed = await placeOrder(opened.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());
    return { table, session: opened.session, orderId: placed.orderId! };
  }

  it("staff paying an order at the exact moment staff (a second device) tries to close its session: order always ends PAID, session ends in a consistent state, and the table recovers cleanly afterward", async () => {
    const { table, session, orderId } = await fixture();

    const [payResult, closeResult] = await Promise.allSettled([payOrder(orderId), closeTableSession(session.id)]);

    // payOrder has no dependency on session state at all (it locks the Order
    // row, not the Table row) — it must always succeed regardless of how
    // closeTableSession interleaves.
    expect(payResult.status).toBe("fulfilled");
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
    expect(order.tableSessionId).toBe(session.id); // never moved

    const sessionAfter = await prisma.tableSession.findUniqueOrThrow({ where: { id: session.id } });
    if (closeResult.status === "fulfilled") {
      // closeTableSession's OPEN-order read happened after payOrder's commit.
      expect(sessionAfter.status).toBe("CLOSED");
    } else {
      // closeTableSession's OPEN-order read happened first (order still
      // OPEN at that instant) and was correctly rejected — a benign,
      // expected outcome, not a bug: the session is simply still ACTIVE.
      expect(sessionAfter.status).toBe("ACTIVE");
    }

    // Whichever branch happened, the table must recover cleanly: opening a
    // new round now must succeed (no OPEN order remains either way, since
    // payOrder always won the order itself), proving the race never leaves
    // the table stuck.
    const reopened = await openTableSession(table.id, randomUUID());
    expect(reopened.success).toBe(true);
    const activeSessions = await prisma.tableSession.count({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeSessions).toBe(1);
  });

  it("amplified: many independent tables racing pay-vs-close never leave a table stuck or an order un-paid", async () => {
    const N = 30;
    const fixtures = await Promise.all(Array.from({ length: N }, () => fixture()));

    try {
      await Promise.allSettled(
        fixtures.flatMap(({ orderId, session }) => [payOrder(orderId), closeTableSession(session.id)])
      );

      for (const { table, session, orderId } of fixtures) {
        const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(order.status).toBe("PAID"); // payOrder always wins the order itself

        const sess = await prisma.tableSession.findUniqueOrThrow({ where: { id: session.id } });
        expect(["ACTIVE", "CLOSED"]).toContain(sess.status);

        // The table must always be recoverable afterward.
        const reopened = await openTableSession(table.id, randomUUID());
        expect(reopened.success).toBe(true);
      }
    } finally {
      const tableIdsInFixture = fixtures.map((f) => f.table.id);
      await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIdsInFixture } } } });
      await prisma.order.deleteMany({ where: { tableId: { in: tableIdsInFixture } } });
      await prisma.table.deleteMany({ where: { id: { in: tableIdsInFixture } } });
    }
  });
});
