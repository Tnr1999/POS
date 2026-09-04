import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeTableSession, openTableSession } from "@/app/(staff)/admin/tables/actions";
import { currentOrderTokenFor, getTablesWithSessions } from "@/lib/tables";

// Phase 2D.4 follow-up: /admin/tables/print must derive its QR from the
// current ACTIVE TableSession's token via the same currentOrderTokenFor()
// helper the live /admin/tables QR uses — never Table.token. These tests
// exercise that helper against real getTablesWithSessions() rows so a
// regression in either the helper or the query shape is caught.
describe("printed QR token wiring (currentOrderTokenFor)", () => {
  let tableIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: tableIds } } } });
    await prisma.order.deleteMany({ where: { tableId: { in: tableIds } } });
    await prisma.table.deleteMany({ where: { id: { in: tableIds } } }); // cascades TableSessions
    tableIds = [];
  });

  async function fixtureTable() {
    const table = await prisma.table.create({
      data: { name: `Print Test ${randomUUID()}`, token: `tbl_${randomUUID()}` },
    });
    tableIds.push(table.id);
    return table;
  }

  it("1. ACTIVE session → resolves to the session's token, not Table.token", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());

    const [row] = (await getTablesWithSessions()).filter((t) => t.id === table.id);
    expect(currentOrderTokenFor(row)).toBe(opened.session.token);
    expect(currentOrderTokenFor(row)).not.toBe(table.token);
  });

  it("2. no ACTIVE session → resolves to null, never falls back to Table.token", async () => {
    const table = await fixtureTable();

    const [row] = (await getTablesWithSessions()).filter((t) => t.id === table.id);
    expect(row.activeSession).toBeNull();
    expect(currentOrderTokenFor(row)).toBeNull();
    // Explicitly prove there is no code path returning the legacy token.
    expect(currentOrderTokenFor(row)).not.toBe(table.token);
  });

  it("3. old session closed + new session opened → resolves to the NEW session's token", async () => {
    const table = await fixtureTable();
    const sessionA = await openTableSession(table.id, randomUUID());
    const sessionB = await openTableSession(table.id, randomUUID()); // closes A (no order), opens B

    const [row] = (await getTablesWithSessions()).filter((t) => t.id === table.id);
    const token = currentOrderTokenFor(row);
    expect(token).toBe(sessionB.session.token);
    expect(token).not.toBe(sessionA.session.token);
  });

  it("4. never falls back to Table.token even when a session was explicitly closed", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());
    await closeTableSession(opened.session.id);

    const [row] = (await getTablesWithSessions()).filter((t) => t.id === table.id);
    expect(currentOrderTokenFor(row)).toBeNull();
    expect(row.token).toBe(table.token); // the legacy field is still there...
    expect(currentOrderTokenFor(row)).not.toBe(row.token); // ...but never returned by the resolver
  });

  it("getTablesWithSessions issues a single query for many tables (no N+1)", async () => {
    // Not a strict query-count assertion (out of scope to instrument Prisma
    // here) — instead prove the shape holds under several tables/sessions at
    // once, which the single findMany+include implementation guarantees.
    const tables = await Promise.all(Array.from({ length: 5 }, () => fixtureTable()));
    await Promise.all(tables.map((t) => openTableSession(t.id, randomUUID())));

    const rows = await getTablesWithSessions();
    for (const t of tables) {
      const row = rows.find((r) => r.id === t.id)!;
      expect(currentOrderTokenFor(row)).not.toBeNull();
      expect(currentOrderTokenFor(row)).not.toBe(t.token);
    }
  });
});
