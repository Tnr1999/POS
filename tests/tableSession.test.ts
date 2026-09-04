import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

// Phase 2D.1 is schema-only: no openTableSession/closeTableSession server
// actions exist yet. These tests exercise the schema/data invariants
// directly via Prisma against the real dev Postgres, since that's the only
// thing this phase actually changed.
describe("TableSession schema (Phase 2D.1)", () => {
  const createdTableIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdOrderIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    // TableSession rows cascade-delete when their Table is deleted, but
    // delete them explicitly first for clarity/robustness regardless of
    // deletion order.
    await prisma.tableSession.deleteMany({ where: { id: { in: createdSessionIds } } });
    await prisma.table.deleteMany({ where: { id: { in: createdTableIds } } });
    createdTableIds.length = 0;
    createdSessionIds.length = 0;
    createdOrderIds.length = 0;
  });

  async function seedTable() {
    const table = await prisma.table.create({
      data: { name: `Test Table ${randomUUID()}`, token: `tbl_${randomUUID()}` },
    });
    createdTableIds.push(table.id);
    return table;
  }

  async function seedSession(tableId: string, overrides: Partial<{ token: string; status: string }> = {}) {
    const session = await prisma.tableSession.create({
      data: {
        tableId,
        token: overrides.token ?? `sess_${randomUUID()}`,
        status: overrides.status ?? "ACTIVE",
      },
    });
    createdSessionIds.push(session.id);
    return session;
  }

  it("1. can create an ACTIVE TableSession with the expected defaults", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id);

    expect(session.status).toBe("ACTIVE");
    expect(session.tableId).toBe(table.id);
    expect(session.startedAt).toBeInstanceOf(Date);
    expect(session.endedAt).toBeNull();
  });

  it("2. TableSession -> Table relation resolves correctly", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id);

    const withTable = await prisma.tableSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { table: true },
    });
    expect(withTable.table.id).toBe(table.id);
    expect(withTable.table.name).toBe(table.name);

    const tableWithSessions = await prisma.table.findUniqueOrThrow({
      where: { id: table.id },
      include: { sessions: true },
    });
    expect(tableWithSessions.sessions.map((s) => s.id)).toContain(session.id);
  });

  it("3. an Order can be created with a tableSessionId pointing at a real session", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id);
    const order = await prisma.order.create({
      data: { type: "DINE_IN", status: "OPEN", tableId: table.id, tableSessionId: session.id },
    });
    createdOrderIds.push(order.id);

    const withSession = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { tableSession: true },
    });
    expect(withSession.tableSession?.id).toBe(session.id);
  });

  it("4. a historical Order with tableSessionId = NULL remains valid and readable", async () => {
    const order = await prisma.order.create({
      data: { type: "TAKEAWAY", status: "PAID", paidAt: new Date() },
    });
    createdOrderIds.push(order.id);

    const fetched = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fetched.tableSessionId).toBeNull();
    expect(fetched.status).toBe("PAID");
  });

  it("5. TableSession.token must be unique", async () => {
    const table = await seedTable();
    const sharedToken = `sess_${randomUUID()}`;
    await seedSession(table.id, { token: sharedToken, status: "CLOSED" });

    const table2 = await seedTable();
    await expect(
      prisma.tableSession.create({ data: { tableId: table2.id, token: sharedToken, status: "ACTIVE" } })
    ).rejects.toThrow();
  });

  it("6. a Table can have at most one ACTIVE TableSession (DB partial unique index)", async () => {
    const table = await seedTable();
    await seedSession(table.id, { status: "ACTIVE" });

    // A second ACTIVE session for the same table must be rejected by the
    // hand-authored partial unique index (TableSession_one_active_per_table),
    // since Prisma's schema language can't declare this constraint itself —
    // see the comment above the TableSession model in schema.prisma.
    await expect(
      prisma.tableSession.create({ data: { tableId: table.id, token: `sess_${randomUUID()}`, status: "ACTIVE" } })
    ).rejects.toThrow();

    // Sanity: only one ACTIVE session actually exists for this table.
    const activeSessions = await prisma.tableSession.findMany({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeSessions).toHaveLength(1);
  });

  it("6b. a Table CAN have multiple CLOSED sessions (the partial index only restricts ACTIVE)", async () => {
    const table = await seedTable();
    await seedSession(table.id, { status: "CLOSED" });
    await seedSession(table.id, { status: "CLOSED" });
    await seedSession(table.id, { status: "CLOSED" });

    const closedSessions = await prisma.tableSession.findMany({ where: { tableId: table.id, status: "CLOSED" } });
    expect(closedSessions).toHaveLength(3);
  });

  it("6c. after a session is closed, a new ACTIVE session for the same table is allowed", async () => {
    const table = await seedTable();
    const first = await seedSession(table.id, { status: "ACTIVE" });
    await prisma.tableSession.update({ where: { id: first.id }, data: { status: "CLOSED", endedAt: new Date() } });

    const second = await seedSession(table.id, { status: "ACTIVE" });
    expect(second.status).toBe("ACTIVE");

    const activeSessions = await prisma.tableSession.findMany({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].id).toBe(second.id);
  });

  it("7. a CLOSED session can still have historical Orders attached to it", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id, { status: "ACTIVE" });
    const order = await prisma.order.create({
      data: { type: "DINE_IN", status: "PAID", paidAt: new Date(), tableId: table.id, tableSessionId: session.id },
    });
    createdOrderIds.push(order.id);

    await prisma.tableSession.update({ where: { id: session.id }, data: { status: "CLOSED", endedAt: new Date() } });

    const closedWithOrders = await prisma.tableSession.findUniqueOrThrow({
      where: { id: session.id },
      include: { orders: true },
    });
    expect(closedWithOrders.status).toBe("CLOSED");
    expect(closedWithOrders.orders.map((o) => o.id)).toContain(order.id);
  });

  it("8. transitioning ACTIVE -> CLOSED persists endedAt", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id, { status: "ACTIVE" });
    expect(session.endedAt).toBeNull();

    const closedAt = new Date();
    const closed = await prisma.tableSession.update({
      where: { id: session.id },
      data: { status: "CLOSED", endedAt: closedAt },
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.endedAt?.getTime()).toBe(closedAt.getTime());
  });

  it("9. existing Phase 2A-2C payment snapshot fields still work correctly alongside tableSessionId", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id);
    const order = await prisma.order.create({
      data: {
        type: "DINE_IN",
        status: "PAID",
        paidAt: new Date(),
        tableId: table.id,
        tableSessionId: session.id,
        subtotalAmount: 18000,
        discountAmount: 0,
        serviceChargeRate: 1000,
        serviceChargeAmount: 1800,
        taxRate: 700,
        taxAmount: 1386,
        grandTotalAmount: 21186,
        paymentMethod: "CASH",
        paidAmount: 22000,
        changeAmount: 814,
      },
    });
    createdOrderIds.push(order.id);

    const fetched = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fetched.tableSessionId).toBe(session.id);
    expect(fetched.grandTotalAmount).toBe(21186);
    expect(fetched.paymentMethod).toBe("CASH");
    expect(fetched.changeAmount).toBe(814);
  });

  it("deleting a Table cascades to its TableSessions, and Orders survive with tableSessionId set to null", async () => {
    const table = await seedTable();
    const session = await seedSession(table.id, { status: "CLOSED" });
    const order = await prisma.order.create({
      data: { type: "DINE_IN", status: "PAID", paidAt: new Date(), tableSessionId: session.id },
    });
    createdOrderIds.push(order.id);

    await prisma.table.delete({ where: { id: table.id } });
    createdTableIds.splice(createdTableIds.indexOf(table.id), 1); // already deleted, don't try again in afterEach
    createdSessionIds.splice(createdSessionIds.indexOf(session.id), 1); // cascaded away already

    const survivingOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(survivingOrder.tableSessionId).toBeNull(); // SetNull, matching Order.tableId's existing behavior
    expect(survivingOrder.status).toBe("PAID"); // order itself is untouched
  });
});
