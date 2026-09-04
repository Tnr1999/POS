import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeTableSession, openTableSession } from "@/app/(staff)/admin/tables/actions";
import { placeOrder, type CartLine } from "@/app/order/[token]/actions";
import { resolveActiveSessionByToken } from "@/lib/tableSessionAccess";
import { GET as pollTable } from "@/app/api/public/tables/[token]/route";

const EXPIRED_MESSAGE = "QR นี้หมดอายุแล้ว";

async function seedTable() {
  return prisma.table.create({ data: { name: `Test Table ${randomUUID()}`, token: `tbl_${randomUUID()}` } });
}

async function seedMenuItem(stock = 50) {
  return prisma.menuItem.create({
    data: { name: `Test Dish ${randomUUID()}`, price: 5000, active: true, trackStock: true, stock },
  });
}

async function poll(token: string) {
  const res = await pollTable(new Request(`http://localhost/api/public/tables/${token}`), {
    params: Promise.resolve({ token }),
  });
  return { status: res.status, body: await res.json() };
}

describe("Phase 2D.4 — customer QR / TableSession order flow", () => {
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
    const table = await seedTable();
    tableIds.push(table.id);
    return table;
  }

  async function fixtureMenuItem(stock = 50) {
    const item = await seedMenuItem(stock);
    menuItemIds.push(item.id);
    return item;
  }

  // ------------------------------------------------------------------
  // Session access
  // ------------------------------------------------------------------
  describe("session access", () => {
    it("1. ACTIVE session token resolves successfully", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());

      const access = await resolveActiveSessionByToken(opened.session.token);
      expect(access).not.toBeNull();
      expect(access!.sessionId).toBe(opened.session.id);
      expect(access!.tableId).toBe(table.id);
    });

    it("2. CLOSED session token is rejected", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      await closeTableSession(opened.session.id);

      expect(await resolveActiveSessionByToken(opened.session.token)).toBeNull();
    });

    it("3. random/unknown token is rejected", async () => {
      expect(await resolveActiveSessionByToken(`unknown-${randomUUID()}`)).toBeNull();
    });

    it("4. old token does not resolve to the new session opened for the same table", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const sessionB = await openTableSession(table.id, randomUUID()); // closes A (no order), opens B

      expect(await resolveActiveSessionByToken(sessionA.session.token)).toBeNull();
      const accessB = await resolveActiveSessionByToken(sessionB.session.token);
      expect(accessB!.sessionId).toBe(sessionB.session.id);
    });

    it("5. no ACTIVE session for the token cannot create an order (placeOrder rejects)", async () => {
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      await expect(placeOrder(`never-opened-${randomUUID()}`, cart, randomUUID())).rejects.toThrow(
        EXPIRED_MESSAGE
      );
    });
  });

  // ------------------------------------------------------------------
  // Order creation
  // ------------------------------------------------------------------
  describe("order creation", () => {
    it("6. a newly created order gets tableSessionId set to the resolving session", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const result = await placeOrder(opened.session.token, cart, randomUUID());
      const order = await prisma.order.findUniqueOrThrow({ where: { id: result.orderId! } });
      expect(order.tableSessionId).toBe(opened.session.id);
      expect(order.tableId).toBe(table.id);
    });

    it("7. OPEN order lookup is scoped by tableSessionId, not just tableId", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();

      const first = await placeOrder(sessionA.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());
      // Settle session A's order so a new round can legally open.
      await prisma.order.update({ where: { id: first.orderId! }, data: { status: "PAID", paidAt: new Date() } });

      const sessionB = await openTableSession(table.id, randomUUID());
      const second = await placeOrder(sessionB.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());

      expect(second.orderId).not.toBe(first.orderId);
      const orderA = await prisma.order.findUniqueOrThrow({ where: { id: first.orderId! } });
      const orderB = await prisma.order.findUniqueOrThrow({ where: { id: second.orderId! } });
      expect(orderA.tableSessionId).toBe(sessionA.session.id);
      expect(orderB.tableSessionId).toBe(sessionB.session.id);
    });

    it("8. multiple phones using the same session token share one OPEN order", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const [phoneA, phoneB, phoneC] = await Promise.all([
        placeOrder(opened.session.token, cart, randomUUID()),
        placeOrder(opened.session.token, cart, randomUUID()),
        placeOrder(opened.session.token, cart, randomUUID()),
      ]);

      expect(phoneB.orderId).toBe(phoneA.orderId);
      expect(phoneC.orderId).toBe(phoneA.orderId);

      const openOrders = await prisma.order.findMany({
        where: { tableSessionId: opened.session.id, status: "OPEN" },
      });
      expect(openOrders).toHaveLength(1);
    });

    it("9. same physical table with two different sessions gets two different OPEN orders, never shared", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();

      const orderA = await placeOrder(sessionA.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());
      await prisma.order.update({ where: { id: orderA.orderId! }, data: { status: "PAID", paidAt: new Date() } });

      const sessionB = await openTableSession(table.id, randomUUID());
      const orderB = await placeOrder(sessionB.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());

      expect(orderB.orderId).not.toBe(orderA.orderId);
      const openUnderB = await prisma.order.findMany({ where: { tableSessionId: sessionB.session.id, status: "OPEN" } });
      expect(openUnderB).toHaveLength(1);
      expect(openUnderB[0].id).toBe(orderB.orderId);
    });

    it("10. an old session cannot create an order after a new session has opened on the same table", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const sessionB = await openTableSession(table.id, randomUUID()); // closes A (no order yet), opens B
      const menuItem = await fixtureMenuItem();

      await expect(
        placeOrder(sessionA.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID())
      ).rejects.toThrow(EXPIRED_MESSAGE);

      const ordersUnderA = await prisma.order.count({ where: { tableSessionId: sessionA.session.id } });
      expect(ordersUnderA).toBe(0);
      const ordersUnderB = await prisma.order.count({ where: { tableSessionId: sessionB.session.id } });
      expect(ordersUnderB).toBe(0); // the rejected old-token request must not have leaked into B either
    });
  });

  // ------------------------------------------------------------------
  // Concurrency / races
  // ------------------------------------------------------------------
  describe("concurrency", () => {
    it("11. concurrent placeOrder calls on the same session never create duplicate OPEN orders", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const [a, b] = await Promise.all([
        placeOrder(opened.session.token, cart, randomUUID()),
        placeOrder(opened.session.token, cart, randomUUID()),
      ]);
      expect(b.orderId).toBe(a.orderId);

      const openOrders = await prisma.order.findMany({ where: { tableSessionId: opened.session.id, status: "OPEN" } });
      expect(openOrders).toHaveLength(1);

      const item = await prisma.menuItem.findUniqueOrThrow({ where: { id: menuItem.id } });
      expect(item.stock).toBe(48); // 50 - 1 - 1, both submissions' items were kept
    });

    // Race A: customer placeOrder vs staff closeTableSession on the same
    // still-empty ACTIVE session, at the same instant. Both serialize behind
    // the same Table row lock, so exactly one of two outcomes is possible —
    // never a third where an Order ends up attached to a CLOSED session.
    it("Race A: concurrent placeOrder + closeTableSession never leaves an order on a CLOSED session", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const [orderResult, closeResult] = await Promise.allSettled([
        placeOrder(opened.session.token, cart, randomUUID()),
        closeTableSession(opened.session.id),
      ]);

      const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: opened.session.id } });
      const orderUnderSession = await prisma.order.findFirst({ where: { tableSessionId: opened.session.id } });

      if (orderUnderSession) {
        // placeOrder won the lock first: the order exists, so the session
        // must still be ACTIVE (closeTableSession must have seen the OPEN
        // order and been rejected) — never CLOSED with an order under it.
        expect(session.status).toBe("ACTIVE");
        expect(closeResult.status).toBe("rejected");
        expect(orderResult.status).toBe("fulfilled");
      } else {
        // closeTableSession won the lock first: session is CLOSED and
        // placeOrder's post-lock re-check must have rejected as expired.
        expect(session.status).toBe("CLOSED");
        expect(orderResult.status).toBe("rejected");
      }
    });

    // Race B: customer placeOrder vs staff starting a brand-new round
    // (openTableSession) on the same table at the same instant. Must never
    // result in the order being silently attached to the new session B
    // because the old token got "remapped".
    it("Race B: concurrent placeOrder + openTableSession (new round) never attaches the order to the new session", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const [orderResult, openResult] = await Promise.allSettled([
        placeOrder(sessionA.session.token, cart, randomUUID()),
        openTableSession(table.id, randomUUID()),
      ]);

      // Whatever happened, no order may ever be tied to session A's token
      // ending up under a *different* session id.
      const anyOrder = await prisma.order.findFirst({ where: { tableId: table.id } });
      if (anyOrder) {
        expect(anyOrder.tableSessionId).toBe(sessionA.session.id); // never a "new" session B
      }

      if (openResult.status === "fulfilled") {
        // Staff's open-new-round won the lock first: session A got closed
        // with no order under it, so placeOrder's re-check must reject.
        expect(orderResult.status).toBe("rejected");
        const sessionAFresh = await prisma.tableSession.findUniqueOrThrow({ where: { id: sessionA.session.id } });
        expect(sessionAFresh.status).toBe("CLOSED");
      } else {
        // placeOrder won the lock first: order landed under A, and the
        // staff's open-new-round must have been rejected for
        // SESSION_HAS_OPEN_ORDER (A is still ACTIVE with an OPEN order).
        expect(orderResult.status).toBe("fulfilled");
        const sessionAFresh = await prisma.tableSession.findUniqueOrThrow({ where: { id: sessionA.session.id } });
        expect(sessionAFresh.status).toBe("ACTIVE");
      }
    });

    it("14. no order can ever be attached to an already-CLOSED session", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      await closeTableSession(opened.session.id);
      const menuItem = await fixtureMenuItem();

      await expect(
        placeOrder(opened.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID())
      ).rejects.toThrow(EXPIRED_MESSAGE);

      const count = await prisma.order.count({ where: { tableSessionId: opened.session.id } });
      expect(count).toBe(0);
    });

    it("15. no duplicate OPEN order is created under many concurrent submissions from different callers", async () => {
      const table = await fixtureTable();
      const opened = await openTableSession(table.id, randomUUID());
      const menuItem = await fixtureMenuItem();
      const cart: CartLine[] = [{ menuItemId: menuItem.id, qty: 1 }];

      const CALLERS = 10;
      const results = await Promise.all(
        Array.from({ length: CALLERS }, () => placeOrder(opened.session.token, cart, randomUUID()))
      );
      const orderIds = new Set(results.map((r) => r.orderId));
      expect(orderIds.size).toBe(1);

      const openOrders = await prisma.order.findMany({ where: { tableSessionId: opened.session.id, status: "OPEN" } });
      expect(openOrders).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------------
  // Polling isolation (Race C)
  // ------------------------------------------------------------------
  describe("polling", () => {
    it("Race C: an old session's polling endpoint stays expired even after a new ACTIVE session opens on the same table, and never shows the new session's order", async () => {
      const table = await fixtureTable();
      const sessionA = await openTableSession(table.id, randomUUID());
      const sessionB = await openTableSession(table.id, randomUUID()); // closes A (no order), opens B
      const menuItem = await fixtureMenuItem();
      await placeOrder(sessionB.session.token, [{ menuItemId: menuItem.id, qty: 1 }], randomUUID());

      const oldPoll = await poll(sessionA.session.token);
      expect(oldPoll.status).toBe(404);
      expect(oldPoll.body.error).toBe("not_found");

      const newPoll = await poll(sessionB.session.token);
      expect(newPoll.status).toBe(200);
      expect(newPoll.body.order).not.toBeNull();
    });

    it("polling an unknown token never leaks internal details", async () => {
      const result = await poll(`unknown-${randomUUID()}`);
      expect(result.status).toBe(404);
      expect(Object.keys(result.body)).toEqual(["error"]);
    });
  });
});

// Amplified variants — single-pair races on a fast local DB can pass "by
// luck" even with a real bug present (established pattern across this
// codebase, see tests/cancelOrderVsAddItem.test.ts and
// tests/tableSessionActions.test.ts). Running many independent
// table/session fixtures through the same race simultaneously gives every
// possible violation many simultaneous chances to land.
describe("Phase 2D.4 — amplified races", () => {
  it("amplified Race A: many concurrent placeOrder + closeTableSession pairs never leave an order on a CLOSED session", async () => {
    const N = 40;
    const fixtures = await Promise.all(
      Array.from({ length: N }, async () => {
        const table = await prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `race_${randomUUID()}` } });
        const menuItem = await prisma.menuItem.create({
          data: { name: `Race Dish ${randomUUID()}`, price: 1000, active: true, trackStock: true, stock: 50 },
        });
        const opened = await openTableSession(table.id, randomUUID());
        return { tableId: table.id, menuItemId: menuItem.id, sessionId: opened.session.id, token: opened.session.token };
      })
    );

    try {
      await Promise.allSettled(
        fixtures.flatMap((f) => [
          placeOrder(f.token, [{ menuItemId: f.menuItemId, qty: 1 }], randomUUID()),
          closeTableSession(f.sessionId),
        ])
      );

      for (const f of fixtures) {
        const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: f.sessionId } });
        const order = await prisma.order.findFirst({ where: { tableSessionId: f.sessionId } });
        if (order) {
          expect(session.status).toBe("ACTIVE"); // an order exists only if the session is still ACTIVE
        }
        if (session.status === "CLOSED") {
          expect(order).toBeNull(); // a CLOSED session must never have an order under it
        }
      }
    } finally {
      const tableIdsInFixture = fixtures.map((f) => f.tableId);
      const menuItemIdsInFixture = fixtures.map((f) => f.menuItemId);
      await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIdsInFixture } } } });
      await prisma.order.deleteMany({ where: { tableId: { in: tableIdsInFixture } } });
      await prisma.stockMovement.deleteMany({ where: { menuItemId: { in: menuItemIdsInFixture } } });
      await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIdsInFixture } } });
      await prisma.table.deleteMany({ where: { id: { in: tableIdsInFixture } } });
    }
  });

  it("amplified: many phones concurrently submitting to the same session never produce more than one OPEN order", async () => {
    const N = 40;
    const fixtures = await Promise.all(
      Array.from({ length: N }, async () => {
        const table = await prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `race_${randomUUID()}` } });
        const menuItem = await prisma.menuItem.create({
          data: { name: `Race Dish ${randomUUID()}`, price: 1000, active: true, trackStock: true, stock: 50 },
        });
        const opened = await openTableSession(table.id, randomUUID());
        return { tableId: table.id, menuItemId: menuItem.id, sessionId: opened.session.id, token: opened.session.token };
      })
    );

    try {
      await Promise.all(
        fixtures.flatMap((f) => [
          placeOrder(f.token, [{ menuItemId: f.menuItemId, qty: 1 }], randomUUID()),
          placeOrder(f.token, [{ menuItemId: f.menuItemId, qty: 1 }], randomUUID()),
          placeOrder(f.token, [{ menuItemId: f.menuItemId, qty: 1 }], randomUUID()),
        ])
      );

      for (const f of fixtures) {
        const openOrders = await prisma.order.findMany({ where: { tableSessionId: f.sessionId, status: "OPEN" } });
        expect(openOrders).toHaveLength(1);
      }
    } finally {
      const tableIdsInFixture = fixtures.map((f) => f.tableId);
      const menuItemIdsInFixture = fixtures.map((f) => f.menuItemId);
      await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIdsInFixture } } } });
      await prisma.order.deleteMany({ where: { tableId: { in: tableIdsInFixture } } });
      await prisma.stockMovement.deleteMany({ where: { menuItemId: { in: menuItemIdsInFixture } } });
      await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIdsInFixture } } });
      await prisma.table.deleteMany({ where: { id: { in: tableIdsInFixture } } });
    }
  });
});
