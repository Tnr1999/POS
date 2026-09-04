import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { closeTableSession, openTableSession } from "@/app/(staff)/admin/tables/actions";
import { TableSessionError, type TableSessionErrorCode } from "@/lib/tableSessionErrors";

async function seedTable() {
  return prisma.table.create({ data: { name: `Test Table ${randomUUID()}`, token: `tbl_${randomUUID()}` } });
}

async function seedOrder(tableId: string, tableSessionId: string, status: "OPEN" | "PAID" | "CANCELLED") {
  return prisma.order.create({
    data: {
      type: "DINE_IN",
      status,
      tableId,
      tableSessionId,
      paidAt: status === "PAID" ? new Date() : null,
    },
  });
}

// An order with no TableSession at all — the shape of an order that
// predates TableSession existing (or any future path that creates a
// DINE_IN order without going through placeOrder's session resolution).
async function seedLegacyOrder(tableId: string, status: "OPEN" | "PAID" | "CANCELLED") {
  return prisma.order.create({
    data: {
      type: "DINE_IN",
      status,
      tableId,
      tableSessionId: null,
      paidAt: status === "PAID" ? new Date() : null,
    },
  });
}

async function expectErrorCode(promise: Promise<unknown>, code: TableSessionErrorCode) {
  try {
    await promise;
    throw new Error("expected the promise to reject");
  } catch (err) {
    expect(err).toBeInstanceOf(TableSessionError);
    expect((err as TableSessionError).code).toBe(code);
  }
}

describe("openTableSession / closeTableSession (Phase 2D.2)", () => {
  const createdTableIds: string[] = [];

  afterEach(async () => {
    // TableSession rows cascade-delete with their Table; Orders'
    // tableSessionId is SetNull on that cascade. Delete Orders first for
    // clarity, then the Table (which cascades its sessions).
    await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: createdTableIds } } } });
    await prisma.order.deleteMany({ where: { tableId: { in: createdTableIds } } });
    await prisma.table.deleteMany({ where: { id: { in: createdTableIds } } });
    createdTableIds.length = 0;
  });

  async function fixtureTable() {
    const table = await seedTable();
    createdTableIds.push(table.id);
    return table;
  }

  // --- Basic ---------------------------------------------------------

  it("1-2. opens a new ACTIVE session when the table has none yet", async () => {
    const table = await fixtureTable();
    const result = await openTableSession(table.id, randomUUID());

    expect(result.success).toBe(true);
    expect(result.session.status).toBe("ACTIVE");
    expect(result.session.tableId).toBe(table.id);
    expect(result.session.endedAt).toBeNull();
  });

  it("3. generates a fresh, unique token per session", async () => {
    const tableA = await fixtureTable();
    const tableB = await fixtureTable();
    const resultA = await openTableSession(tableA.id, randomUUID());
    const resultB = await openTableSession(tableB.id, randomUUID());

    expect(resultA.session.token).not.toBe(resultB.session.token);
    expect(typeof resultA.session.token).toBe("string");
    expect(resultA.session.token.length).toBeGreaterThan(0);
  });

  it("4. the created session belongs to the correct Table", async () => {
    const table = await fixtureTable();
    const result = await openTableSession(table.id, randomUUID());
    const stored = await prisma.tableSession.findUniqueOrThrow({ where: { id: result.session.id } });
    expect(stored.tableId).toBe(table.id);
  });

  it("5. rejects with TABLE_NOT_FOUND for a nonexistent table", async () => {
    await expectErrorCode(openTableSession("does-not-exist", randomUUID()), "TABLE_NOT_FOUND");
  });

  // --- Existing order rules -------------------------------------------

  it("6. ACTIVE session + OPEN order: opening a new session is rejected, nothing changes", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    const order = await seedOrder(table.id, first.session.id, "OPEN");

    await expectErrorCode(openTableSession(table.id, randomUUID()), "SESSION_HAS_OPEN_ORDER");

    const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: first.session.id } });
    expect(session.status).toBe("ACTIVE");
    const stillOpen = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stillOpen.status).toBe("OPEN");
    const sessionCount = await prisma.tableSession.count({ where: { tableId: table.id } });
    expect(sessionCount).toBe(1); // no second session was created
  });

  it("7. ACTIVE session + only PAID orders: a new session can be opened", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    await seedOrder(table.id, first.session.id, "PAID");

    const second = await openTableSession(table.id, randomUUID());
    expect(second.success).toBe(true);
    expect(second.session.id).not.toBe(first.session.id);
  });

  it("8. ACTIVE session + only CANCELLED orders: a new session can be opened", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    await seedOrder(table.id, first.session.id, "CANCELLED");

    const second = await openTableSession(table.id, randomUUID());
    expect(second.success).toBe(true);
    expect(second.session.id).not.toBe(first.session.id);
  });

  it("9-12. opening a new round closes the previous session (endedAt set, old orders keep their session, new session is distinct)", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    const paidOrder = await seedOrder(table.id, first.session.id, "PAID");

    const second = await openTableSession(table.id, randomUUID());

    const oldSession = await prisma.tableSession.findUniqueOrThrow({ where: { id: first.session.id } });
    expect(oldSession.status).toBe("CLOSED"); // 9
    expect(oldSession.endedAt).not.toBeNull(); // 10

    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });
    expect(orderAfter.tableSessionId).toBe(first.session.id); // 11 - unchanged

    expect(second.session.id).not.toBe(first.session.id); // 12
    expect(second.session.token).not.toBe(first.session.token); // 12
    expect(second.session.status).toBe("ACTIVE");

    const activeCount = await prisma.tableSession.count({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  // --- Close -----------------------------------------------------------

  it("13-15. closes an ACTIVE session with no open order, setting CLOSED + endedAt", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());

    const result = await closeTableSession(opened.session.id);
    expect(result.success).toBe(true);
    expect(result.alreadyClosed).toBe(false);
    expect(result.session.status).toBe("CLOSED"); // 14
    expect(result.session.endedAt).not.toBeNull(); // 15
  });

  it("16. closing an already-CLOSED session is a safe no-op: same endedAt, alreadyClosed=true", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());
    const first = await closeTableSession(opened.session.id);

    const second = await closeTableSession(opened.session.id);
    expect(second.alreadyClosed).toBe(true);
    expect(second.session.endedAt?.getTime()).toBe(first.session.endedAt?.getTime());
  });

  it("17. a session with an OPEN order cannot be closed", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());
    await seedOrder(table.id, opened.session.id, "OPEN");

    await expectErrorCode(closeTableSession(opened.session.id), "SESSION_HAS_OPEN_ORDER");

    const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: opened.session.id } });
    expect(session.status).toBe("ACTIVE");
    expect(session.endedAt).toBeNull();
  });

  it("18-19. closing a session never cancels/modifies its orders — PAID orders are untouched", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());
    const paidOrder = await seedOrder(table.id, opened.session.id, "PAID");
    const before = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });

    await closeTableSession(opened.session.id);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } });
    expect(after).toEqual(before); // byte-for-byte unchanged
  });

  it("closeTableSession rejects with SESSION_NOT_FOUND for a nonexistent session", async () => {
    await expectErrorCode(closeTableSession("does-not-exist"), "SESSION_NOT_FOUND");
  });

  // --- Concurrency (non-idempotency) --------------------------------------

  it("20. concurrent opens (different keys) on the same (previously empty) table never produce two ACTIVE sessions", async () => {
    const table = await fixtureTable();
    const results = await Promise.allSettled([
      openTableSession(table.id, randomUUID()),
      openTableSession(table.id, randomUUID()),
    ]);
    for (const r of results) expect(r.status).toBe("fulfilled");

    const activeSessions = await prisma.tableSession.findMany({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeSessions).toHaveLength(1);
  });

  it("21. concurrent closes on the same session: exactly one real transition, endedAt stable", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());

    const results = await Promise.allSettled([
      closeTableSession(opened.session.id),
      closeTableSession(opened.session.id),
    ]);
    for (const r of results) expect(r.status).toBe("fulfilled");

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof closeTableSession>>> => r.status === "fulfilled"
    );
    const endedAtValues = new Set(fulfilled.map((r) => r.value.session.endedAt?.getTime()));
    expect(endedAtValues.size).toBe(1); // both calls agree on the exact same endedAt

    const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: opened.session.id } });
    expect(session.status).toBe("CLOSED");
  });

  it("22. an open-vs-close race on the same table resolves to exactly one deterministic ACTIVE session", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID()); // ACTIVE, no order under it

    const results = await Promise.allSettled([
      openTableSession(table.id, randomUUID()),
      closeTableSession(opened.session.id),
    ]);
    for (const r of results) expect(r.status).toBe("fulfilled");

    const activeSessions = await prisma.tableSession.findMany({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeSessions).toHaveLength(1); // never zero, never two

    const originalSession = await prisma.tableSession.findUniqueOrThrow({ where: { id: opened.session.id } });
    expect(originalSession.status).toBe("CLOSED");
    expect(originalSession.endedAt).not.toBeNull();
  });

  // --- Idempotency -----------------------------------------------------
  //
  // Approved fix: TableSession.idempotencyKey (nullable, unique) persists
  // which session a given key already produced, checked inside the same
  // Table row lock as everything else — see openTableSession's doc comment
  // for the full reasoning.

  it("idempotency 1. missing idempotency key is rejected", async () => {
    const table = await fixtureTable();
    // @ts-expect-error - intentionally omitting the now-required argument to prove the runtime guard still catches it (e.g. a JS caller, or a bad retry wrapper)
    await expectErrorCode(openTableSession(table.id), "INVALID_IDEMPOTENCY_KEY");
  });

  it("idempotency 2. empty-string idempotency key is rejected", async () => {
    const table = await fixtureTable();
    await expectErrorCode(openTableSession(table.id, ""), "INVALID_IDEMPOTENCY_KEY");
  });

  it("idempotency 3. first request with a key creates a session", async () => {
    const table = await fixtureTable();
    const result = await openTableSession(table.id, randomUUID());
    expect(result.success).toBe(true);
    expect(result.session.status).toBe("ACTIVE");
  });

  it("idempotency 4-6. a sequential retry with the same key returns the same session, unmodified (no close, no new token, no timestamp changes)", async () => {
    const table = await fixtureTable();
    const key = randomUUID();

    const first = await openTableSession(table.id, key);
    const retry = await openTableSession(table.id, key);

    expect(retry.session.id).toBe(first.session.id); // 4: same session
    expect(retry.session.token).toBe(first.session.token); // 6: no new token
    expect(retry.session.status).toBe("ACTIVE"); // 5: not closed
    expect(retry.session.startedAt.getTime()).toBe(first.session.startedAt.getTime());
    expect(retry.session.endedAt).toBeNull();

    // Confirm at the DB level too: still exactly one session for this table.
    const sessionCount = await prisma.tableSession.count({ where: { tableId: table.id } });
    expect(sessionCount).toBe(1);
  });

  it("idempotency 7. the same key against a different table is rejected, never moves the session", async () => {
    const tableA = await fixtureTable();
    const tableB = await fixtureTable();
    const key = randomUUID();

    const first = await openTableSession(tableA.id, key);
    await expectErrorCode(openTableSession(tableB.id, key), "INVALID_IDEMPOTENCY_KEY");

    // Session A is untouched and still belongs to table A.
    const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: first.session.id } });
    expect(session.tableId).toBe(tableA.id);
    // Table B never got a session out of this.
    const tableBSessions = await prisma.tableSession.count({ where: { tableId: tableB.id } });
    expect(tableBSessions).toBe(0);
  });

  it("idempotency 8. a different key is treated as a new operation (closes the old session, opens a new one)", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    const second = await openTableSession(table.id, randomUUID());

    expect(second.session.id).not.toBe(first.session.id);
    const oldSession = await prisma.tableSession.findUniqueOrThrow({ where: { id: first.session.id } });
    expect(oldSession.status).toBe("CLOSED");
  });

  it("idempotency 9-10. concurrent opens with the same key on the same table resolve to exactly one session, both returning it", async () => {
    const table = await fixtureTable();
    const key = randomUUID();

    const [a, b] = await Promise.all([openTableSession(table.id, key), openTableSession(table.id, key)]);

    expect(a.session.id).toBe(b.session.id); // 10: both return the same session
    const sessionCount = await prisma.tableSession.count({ where: { tableId: table.id } });
    expect(sessionCount).toBe(1); // 9: exactly one session, no raw constraint error surfaced
    const activeCount = await prisma.tableSession.count({ where: { tableId: table.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("idempotency 11. a same-key retry resolves from the key first, even once an OPEN order exists under the resulting session", async () => {
    const table = await fixtureTable();
    const key = randomUUID();

    const first = await openTableSession(table.id, key);
    // A customer places an order under the session the first call created -
    // simulating time passing between the original request and its retry.
    await seedOrder(table.id, first.session.id, "OPEN");

    // The retry must resolve directly from idempotencyKey and return the
    // same session - it must NOT fall through to the "ACTIVE + OPEN order"
    // rejection path, because from this caller's point of view it isn't
    // asking to start a new round, it's re-confirming a request that
    // already succeeded.
    const retry = await openTableSession(table.id, key);
    expect(retry.session.id).toBe(first.session.id);
    expect(retry.session.status).toBe("ACTIVE");
  });

  it("idempotency 12. a historical session with idempotencyKey = NULL remains valid and doesn't collide with new keyed sessions", async () => {
    const table = await fixtureTable();
    // Simulates a session created before this field existed (or by any
    // future path that legitimately omits it) - never backfilled.
    const legacy = await prisma.tableSession.create({
      data: { tableId: table.id, token: `legacy_${randomUUID()}`, status: "CLOSED" },
    });
    expect(legacy.idempotencyKey).toBeNull();

    // A brand-new keyed open still works fine alongside it.
    const opened = await openTableSession(table.id, randomUUID());
    expect(opened.success).toBe(true);

    const stillThere = await prisma.tableSession.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(stillThere.idempotencyKey).toBeNull();
  });
});

// Single-pair concurrency tests can pass even with a real bug, or fail for
// the wrong reason, depending on how the local DB happens to schedule two
// racing transactions (confirmed by hand in an earlier pass: removing the
// Table row lock made the single-pair open test still pass by luck, while
// only the single-pair close test reliably caught the endedAt-overwrite bug
// on its own). Running many independent tables through the same race
// simultaneously gives every kind of violation many simultaneous chances to
// land — same philosophy as tests/cancelOrderVsAddItem.test.ts and
// tests/payOrder.test.ts's amplified sections.
describe("openTableSession / closeTableSession concurrency (amplified)", () => {
  it("many concurrent double-opens (different keys) on independent fresh tables always resolve cleanly to exactly one ACTIVE session each", async () => {
    const N = 40;
    const tables = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `race_${randomUUID()}` } })
      )
    );

    try {
      const results = await Promise.allSettled(
        tables.flatMap((t) => [openTableSession(t.id, randomUUID()), openTableSession(t.id, randomUUID())])
      );
      // With the Table row lock in place, a concurrent pair of opens on a
      // genuinely fresh table should never spuriously fail — one creates
      // directly, the other gracefully closes-and-reopens. A rejection
      // here would mean the lock let two transactions race the DB's
      // partial-unique-index safety net directly instead of serializing.
      for (const r of results) expect(r.status).toBe("fulfilled");

      for (const t of tables) {
        const activeSessions = await prisma.tableSession.findMany({ where: { tableId: t.id, status: "ACTIVE" } });
        expect(activeSessions).toHaveLength(1);
      }
    } finally {
      await prisma.order.deleteMany({ where: { tableId: { in: tables.map((t) => t.id) } } });
      await prisma.table.deleteMany({ where: { id: { in: tables.map((t) => t.id) } } });
    }
  });

  it("many concurrent double-closes on independent sessions always agree on a single, stable endedAt", async () => {
    const N = 40;
    const tables = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `race_${randomUUID()}` } })
      )
    );

    try {
      const opened = await Promise.all(tables.map((t) => openTableSession(t.id, randomUUID())));

      const results = await Promise.allSettled(
        opened.flatMap((o) => [closeTableSession(o.session.id), closeTableSession(o.session.id)])
      );
      for (const r of results) expect(r.status).toBe("fulfilled");

      for (const o of opened) {
        const fresh = await prisma.tableSession.findUniqueOrThrow({ where: { id: o.session.id } });
        expect(fresh.status).toBe("CLOSED");
      }

      // Group the fulfilled results back per-session and confirm both
      // calls for the same session always report the exact same endedAt -
      // this is the specific invariant that fails without the row lock
      // (one call's UPDATE can silently overwrite the other's endedAt).
      const fulfilled = results.filter(
        (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof closeTableSession>>> => r.status === "fulfilled"
      );
      const endedAtBySession = new Map<string, Set<number>>();
      for (const r of fulfilled) {
        const set = endedAtBySession.get(r.value.session.id) ?? new Set<number>();
        set.add(r.value.session.endedAt!.getTime());
        endedAtBySession.set(r.value.session.id, set);
      }
      for (const set of endedAtBySession.values()) {
        expect(set.size).toBe(1);
      }
    } finally {
      await prisma.order.deleteMany({ where: { tableId: { in: tables.map((t) => t.id) } } });
      await prisma.table.deleteMany({ where: { id: { in: tables.map((t) => t.id) } } });
    }
  });

  it("many concurrent same-key double-opens on independent tables each resolve to exactly one session, both callers agreeing", async () => {
    const N = 40;
    const tables = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.table.create({ data: { name: `Race ${randomUUID()}`, token: `race_${randomUUID()}` } })
      )
    );
    const keys = tables.map(() => randomUUID());

    try {
      const results = await Promise.allSettled(
        tables.flatMap((t, i) => [openTableSession(t.id, keys[i]), openTableSession(t.id, keys[i])])
      );
      for (const r of results) expect(r.status).toBe("fulfilled");

      const fulfilled = results as PromiseFulfilledResult<Awaited<ReturnType<typeof openTableSession>>>[];
      for (let i = 0; i < tables.length; i++) {
        const [a, b] = [fulfilled[i * 2].value, fulfilled[i * 2 + 1].value];
        expect(a.session.id).toBe(b.session.id); // both callers agree on the same session

        const sessionCount = await prisma.tableSession.count({ where: { tableId: tables[i].id } });
        expect(sessionCount).toBe(1); // never a duplicate, never a raw constraint error
      }
    } finally {
      await prisma.order.deleteMany({ where: { tableId: { in: tables.map((t) => t.id) } } });
      await prisma.table.deleteMany({ where: { id: { in: tables.map((t) => t.id) } } });
    }
  });
});

// Legacy OPEN order guard (approved follow-up to Phase 2D.4's audit): a
// leftover OPEN order with tableSessionId = NULL — the shape of any order
// that predates TableSession, or was otherwise created outside the
// session-aware placeOrder path — must block opening a new round exactly
// like a session-scoped OPEN order does. Without this guard, such a table
// looked READY in the admin UI (getTablesWithSessions only inspects ACTIVE
// sessions) and opening it let a customer create a second, simultaneous
// OPEN order for the same physical table — reproduced and confirmed before
// this guard was added.
describe("openTableSession legacy OPEN order guard", () => {
  const createdTableIds: string[] = [];

  afterEach(async () => {
    await prisma.orderItem.deleteMany({ where: { order: { tableId: { in: createdTableIds } } } });
    await prisma.order.deleteMany({ where: { tableId: { in: createdTableIds } } });
    await prisma.table.deleteMany({ where: { id: { in: createdTableIds } } });
    createdTableIds.length = 0;
  });

  async function fixtureTable() {
    const table = await seedTable();
    createdTableIds.push(table.id);
    return table;
  }

  it("1. a legacy OPEN order with no ACTIVE session blocks opening a new session", async () => {
    const table = await fixtureTable();
    const legacy = await seedLegacyOrder(table.id, "OPEN");

    await expectErrorCode(openTableSession(table.id, randomUUID()), "TABLE_HAS_LEGACY_OPEN_ORDER");

    const sessionCount = await prisma.tableSession.count({ where: { tableId: table.id } });
    expect(sessionCount).toBe(0); // no TableSession was created

    const stillOpen = await prisma.order.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(stillOpen.status).toBe("OPEN"); // untouched
    expect(stillOpen.tableSessionId).toBeNull(); // never adopted into a session
  });

  it("2. a legacy PAID order does not block opening a new session", async () => {
    const table = await fixtureTable();
    await seedLegacyOrder(table.id, "PAID");

    const result = await openTableSession(table.id, randomUUID());
    expect(result.success).toBe(true);
  });

  it("3. a legacy CANCELLED order does not block opening a new session", async () => {
    const table = await fixtureTable();
    await seedLegacyOrder(table.id, "CANCELLED");

    const result = await openTableSession(table.id, randomUUID());
    expect(result.success).toBe(true);
  });

  it("4. the existing session-scoped guard is unchanged: a session-scoped OPEN order still rejects with SESSION_HAS_OPEN_ORDER, not the legacy code", async () => {
    const table = await fixtureTable();
    const first = await openTableSession(table.id, randomUUID());
    await seedOrder(table.id, first.session.id, "OPEN"); // session-scoped, not legacy

    await expectErrorCode(openTableSession(table.id, randomUUID()), "SESSION_HAS_OPEN_ORDER");
  });

  it("4b. a legacy OPEN order still blocks even when the current ACTIVE session itself has no open order (guard applies independently of session state)", async () => {
    const table = await fixtureTable();
    const opened = await openTableSession(table.id, randomUUID());
    const legacy = await seedLegacyOrder(table.id, "OPEN");

    await expectErrorCode(openTableSession(table.id, randomUUID()), "TABLE_HAS_LEGACY_OPEN_ORDER");

    // Rejected entirely inside the transaction — the old session must NOT
    // have been closed as a side effect of a request that ultimately failed.
    const session = await prisma.tableSession.findUniqueOrThrow({ where: { id: opened.session.id } });
    expect(session.status).toBe("ACTIVE");
    const stillOpen = await prisma.order.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(stillOpen.tableSessionId).toBeNull();
  });

  it("5. an idempotent retry (same key as an earlier successful open) is never blocked by the legacy guard", async () => {
    const table = await fixtureTable();
    const key = randomUUID();
    const first = await openTableSession(table.id, key);

    // A legacy OPEN order shows up afterward — a genuinely new open would
    // now be rejected, but this is a retry of the same already-succeeded
    // request and must resolve straight from the idempotency key.
    await seedLegacyOrder(table.id, "OPEN");

    const retry = await openTableSession(table.id, key);
    expect(retry.session.id).toBe(first.session.id);
  });

  it("6. concurrent opens against a table with a legacy OPEN order are both rejected, never creating a stray session", async () => {
    const table = await fixtureTable();
    await seedLegacyOrder(table.id, "OPEN");

    const results = await Promise.allSettled([
      openTableSession(table.id, randomUUID()),
      openTableSession(table.id, randomUUID()),
    ]);
    for (const r of results) expect(r.status).toBe("rejected");

    const sessionCount = await prisma.tableSession.count({ where: { tableId: table.id } });
    expect(sessionCount).toBe(0);
  });

  it("7. invariant: this physical table never ends up with more than one OPEN order", async () => {
    const table = await fixtureTable();
    await seedLegacyOrder(table.id, "OPEN");

    await Promise.allSettled([openTableSession(table.id, randomUUID()), openTableSession(table.id, randomUUID())]);

    const openOrders = await prisma.order.count({ where: { tableId: table.id, status: "OPEN" } });
    expect(openOrders).toBe(1); // only the original legacy order — no second one was ever created
  });
});

// Amplified variant, same methodology as the other concurrency suites in
// this file: many independent tables, each with its own legacy OPEN order,
// racing two concurrent opens simultaneously.
describe("openTableSession legacy OPEN order guard (amplified)", () => {
  it("many concurrent double-opens against independent tables that each have a legacy OPEN order are always rejected, never creating a session or a second OPEN order", async () => {
    const N = 40;
    const tables = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.table.create({ data: { name: `Legacy Race ${randomUUID()}`, token: `legacyrace_${randomUUID()}` } })
      )
    );

    try {
      await Promise.all(tables.map((t) => seedLegacyOrder(t.id, "OPEN")));

      const results = await Promise.allSettled(
        tables.flatMap((t) => [openTableSession(t.id, randomUUID()), openTableSession(t.id, randomUUID())])
      );
      for (const r of results) expect(r.status).toBe("rejected");

      for (const t of tables) {
        const sessionCount = await prisma.tableSession.count({ where: { tableId: t.id } });
        expect(sessionCount).toBe(0);
        const openOrders = await prisma.order.count({ where: { tableId: t.id, status: "OPEN" } });
        expect(openOrders).toBe(1); // still just the original legacy order
      }
    } finally {
      await prisma.order.deleteMany({ where: { tableId: { in: tables.map((t) => t.id) } } });
      await prisma.table.deleteMany({ where: { id: { in: tables.map((t) => t.id) } } });
    }
  });
});
