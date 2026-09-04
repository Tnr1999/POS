"use server";

import { revalidatePath, updateTag } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { Prisma } from "@/generated/prisma/client";
import { TableSessionError } from "@/lib/tableSessionErrors";

type Tx = Prisma.TransactionClient;

export async function createTable(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.table.create({ data: { name, token: nanoid(12) } });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}

export async function regenerateTableToken(tableId: string) {
  await requireStaff();
  await prisma.table.update({
    where: { id: tableId },
    data: { token: nanoid(12) },
  });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}

export async function deleteTable(tableId: string) {
  await requireStaff();
  const openOrder = await prisma.order.findFirst({
    where: { tableId, status: "OPEN" },
  });
  if (openOrder) {
    throw new Error("ไม่สามารถลบโต๊ะที่มีออเดอร์ค้างอยู่ได้ กรุณาปิดบิลก่อน");
  }
  await prisma.table.delete({ where: { id: tableId } });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}

// ---------------------------------------------------------------------------
// Table Session lifecycle (Phase 2D.2, wired into customer ordering in 2D.4)
//
// A TableSession represents one occupancy round for a Table. As of Phase
// 2D.4, TableSession.token — not Table.token — is what placeOrder, the
// customer order page, and the polling API resolve against; a token only
// grants access while its session is ACTIVE (see
// src/lib/tableSessionAccess.ts). Table.token above (createTable/
// regenerateTableToken) is legacy: it still exists and is still what
// /admin/tables/print renders, but it is no longer authoritative for
// customer ordering and opening/closing a session here does not change it.
// See the doc comments on openTableSession/closeTableSession below for the
// exact session lifecycle contract.
// ---------------------------------------------------------------------------

// TableSessionError / TableSessionErrorCode live in src/lib/tableSessionErrors.ts,
// not here — Next.js only allows a "use server" file to export async
// functions, and an exported class (even one just re-exported) breaks the
// build. Re-export the type only (erased at compile time, not a runtime
// value, so it doesn't trip that restriction) for convenient importing
// alongside the functions below.
export type { TableSessionErrorCode } from "@/lib/tableSessionErrors";

export type TableSessionSnapshot = {
  id: string;
  tableId: string;
  token: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
};

function toSnapshot(session: TableSessionSnapshot): TableSessionSnapshot {
  return {
    id: session.id,
    tableId: session.tableId,
    token: session.token,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  };
}

function isUniqueConstraintViolation(err: unknown, columnNameFragment: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  const target = err.meta?.target;
  const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return targetText.includes(columnNameFragment);
}

const MAX_TOKEN_ATTEMPTS = 5;

/**
 * Creates a fresh ACTIVE TableSession row, retrying with a new nanoid token
 * on the astronomically unlikely event of a collision against
 * TableSession.token's unique constraint — callers never see that raw DB
 * error. Must be called with the Table row already locked by the caller
 * (see openTableSession) so this insert can never race against another
 * session being opened for the same table.
 */
async function createActiveSession(tx: Tx, tableId: string, idempotencyKey: string) {
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    try {
      return await tx.tableSession.create({
        data: { tableId, token: nanoid(12), status: "ACTIVE", idempotencyKey },
      });
    } catch (err) {
      if (isUniqueConstraintViolation(err, "token")) continue;
      throw err;
    }
  }
  throw new TableSessionError("UNKNOWN_ERROR", "ไม่สามารถสร้าง QR ใหม่ได้ กรุณาลองใหม่อีกครั้ง");
}

export type OpenTableSessionResult = { success: true; session: TableSessionSnapshot };

/**
 * Opens a new occupancy round for a table. `idempotencyKey` is required —
 * see the "Idempotency" section below for why a server-generated key
 * cannot substitute for one the client controls.
 *
 * - This exact idempotencyKey already has a session (see Idempotency below)
 *   -> returns that session as-is, whatever its current state.
 * - No ACTIVE session exists yet -> creates one.
 * - An ACTIVE session exists with an OPEN order under it -> rejected
 *   (SESSION_HAS_OPEN_ORDER). Never auto-cancels the order, never closes
 *   the session, never creates a new one — staff must resolve the order
 *   (pay or cancel it) first.
 * - An ACTIVE session exists with no OPEN order under it -> this is a
 *   deliberate "start a new round" request: the old session is closed
 *   (status=CLOSED, endedAt=now) and a new ACTIVE session is created, in
 *   the same transaction. PAID/CANCELLED orders under the old session are
 *   left completely untouched and keep pointing at it.
 * - The table has a legacy OPEN order with tableSessionId = NULL (an order
 *   that predates TableSession, or was otherwise created outside the
 *   session-aware placeOrder path) -> rejected (TABLE_HAS_LEGACY_OPEN_ORDER),
 *   exactly like a session-scoped OPEN order would be. Never auto-adopted
 *   into the new session, never auto-paid/cancelled — staff must resolve it
 *   through the existing POS payment/cancel flow first. Without this check,
 *   a table with such a leftover order would appear READY in the admin UI
 *   (getTablesWithSessions only looks at ACTIVE sessions) and opening it
 *   would let a customer create a second, simultaneous OPEN order for the
 *   same physical table.
 *
 * Concurrency: takes a row lock on the Table (`SELECT ... FOR UPDATE`) as
 * the transaction's very first statement — the same DB-level, not
 * in-memory, primitive already used by placeOrder/addItemToOrder/
 * cancelOrder/payOrder. Two concurrent calls for the same table (two staff
 * devices, a genuine race with closeTableSession, or two copies of the
 * exact same retried request) fully serialize: whichever acquires the lock
 * first runs to completion before the second one's own checks even begin.
 * Combined with the idempotency check below being *inside* the lock, this
 * is what makes two concurrent calls with the same idempotencyKey resolve
 * to the very same session, never two - the second call's lookup-by-key
 * always sees the first call's already-committed row, and never even
 * reaches the create-a-session path. The DB-level partial unique index
 * added in Phase 2D.1 (`TableSession_one_active_per_table`) remains a
 * backstop in case this lock is ever bypassed by a future bug, not the
 * primary defense.
 *
 * Idempotency: `idempotencyKey` identifies one logical "open this table"
 * request from the caller (a fresh `crypto.randomUUID()` per user-initiated
 * click, reused across that same click's retries — the same pattern
 * `placeOrder`/`CartFlowSheet.tsx` already use). It is required, not
 * optional, and a server-generated key would defeat the entire point: the
 * client is what needs to recognize "this is a retry of my own earlier
 * request" after a network timeout, and only the client can know that — a
 * key minted fresh on the server for every call could never distinguish a
 * retry from a genuinely new request. Each key is checked (and, on the
 * winning path, persisted) *inside* the Table row lock, so:
 *   - the same key, retried any number of times against the same table,
 *     always returns the exact same session (never re-closes it, never
 *     generates a new token, never touches startedAt/endedAt again) -
 *     regardless of what happened to that session since (including an
 *     OPEN order having been placed under it - this short-circuits before
 *     the OPEN-order check even runs, since re-confirming "the result of
 *     my own already-completed request" is not a new "start a round" ask);
 *   - the same key against a *different* table is rejected
 *     (INVALID_IDEMPOTENCY_KEY) rather than silently moving the session -
 *     a key is scoped to the table it was first used for;
 *   - a different key is always treated as its own, independent operation.
 */
export async function openTableSession(tableId: string, idempotencyKey: string): Promise<OpenTableSessionResult> {
  await requireStaff();

  if (!tableId) {
    throw new TableSessionError("TABLE_NOT_FOUND", "ไม่พบโต๊ะนี้");
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
    throw new TableSessionError("INVALID_IDEMPOTENCY_KEY", "idempotencyKey ไม่ถูกต้อง");
  }

  try {
    const session = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Table" WHERE id = ${tableId} FOR UPDATE`;
      if (locked.length === 0) {
        throw new TableSessionError("TABLE_NOT_FOUND", "ไม่พบโต๊ะนี้");
      }

      // Idempotency check, inside the lock: if this exact key already
      // produced a session, this call is a retry of that same request -
      // return it unchanged and skip every other check below entirely
      // (including the OPEN-order rule, which only applies to a genuine
      // "start a new round" request, not to re-confirming one that already
      // happened).
      const existingByKey = await tx.tableSession.findUnique({ where: { idempotencyKey } });
      if (existingByKey) {
        if (existingByKey.tableId !== tableId) {
          throw new TableSessionError(
            "INVALID_IDEMPOTENCY_KEY",
            "idempotencyKey นี้ถูกใช้กับโต๊ะอื่นไปแล้ว"
          );
        }
        return existingByKey;
      }

      const activeSession = await tx.tableSession.findFirst({ where: { tableId, status: "ACTIVE" } });

      if (activeSession) {
        const openOrder = await tx.order.findFirst({
          where: { tableSessionId: activeSession.id, status: "OPEN" },
        });
        if (openOrder) {
          throw new TableSessionError("SESSION_HAS_OPEN_ORDER", "โต๊ะนี้ยังมีออเดอร์ค้างอยู่");
        }
      }

      // Legacy guard: an OPEN order with no session at all (tableSessionId
      // NULL) must block opening a new round exactly like a session-scoped
      // OPEN order does — checked after the idempotency short-circuit above
      // (a retry of an already-succeeded open must never be blocked by
      // this) and after the session-scoped check above (preserving its
      // existing precedence), but before any write, so a rejection here
      // never leaves the old session closed with nothing opened in its
      // place. Never mutates the legacy order — no adopting it into the new
      // session, no auto-pay/cancel; staff resolve it via the existing
      // POS flow first.
      const legacyOpenOrder = await tx.order.findFirst({
        where: { tableId, tableSessionId: null, status: "OPEN" },
      });
      if (legacyOpenOrder) {
        throw new TableSessionError(
          "TABLE_HAS_LEGACY_OPEN_ORDER",
          "โต๊ะนี้มีออเดอร์ค้างจากรอบก่อน กรุณาชำระเงินหรือยกเลิกออเดอร์ก่อนเปิดรอบใหม่"
        );
      }

      if (activeSession) {
        // Case C: an ACTIVE session with no OPEN order under it (neither
        // session-scoped nor legacy). Close it before opening the new one,
        // inside this same locked transaction, so no concurrent reader can
        // ever observe a moment where the table has zero ACTIVE sessions.
        await tx.tableSession.update({
          where: { id: activeSession.id },
          data: { status: "CLOSED", endedAt: new Date() },
        });
      }

      return createActiveSession(tx, tableId, idempotencyKey);
    });

    return { success: true, session: toSnapshot(session) };
  } catch (err) {
    if (err instanceof TableSessionError) throw err;
    throw new TableSessionError("UNKNOWN_ERROR", "เปิดโต๊ะไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}

export type CloseTableSessionResult = {
  success: true;
  session: TableSessionSnapshot;
  alreadyClosed: boolean;
};

/**
 * Ends an occupancy round.
 *
 * - Session has an OPEN order under it -> rejected (SESSION_HAS_OPEN_ORDER).
 *   Never cancels the order, never restores stock, never closes the
 *   session — staff must resolve the order first, exactly like
 *   openTableSession's equivalent case.
 * - Session is already CLOSED -> idempotent no-op: returns the existing
 *   state (`alreadyClosed: true`) without touching `endedAt` or
 *   re-running the OPEN-order check.
 * - Otherwise -> sets status=CLOSED, endedAt=now().
 *
 * Concurrency: same Table row lock as openTableSession, acquired after a
 * first read of the session (only to learn which Table to lock), then the
 * session is re-read *after* the lock is held so every decision below acts
 * on a state no concurrent open/close for this table can have changed out
 * from under it.
 */
export async function closeTableSession(sessionId: string): Promise<CloseTableSessionResult> {
  await requireStaff();

  if (!sessionId) {
    throw new TableSessionError("SESSION_NOT_FOUND", "ไม่พบ session นี้");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const initial = await tx.tableSession.findUnique({ where: { id: sessionId } });
      if (!initial) {
        throw new TableSessionError("SESSION_NOT_FOUND", "ไม่พบ session นี้");
      }

      await tx.$queryRaw`SELECT id FROM "Table" WHERE id = ${initial.tableId} FOR UPDATE`;

      // Re-read after acquiring the lock — another transaction may have
      // changed this session's status while this one was waiting for it.
      const session = await tx.tableSession.findUniqueOrThrow({ where: { id: sessionId } });

      if (session.status === "CLOSED") {
        return { session, alreadyClosed: true as const };
      }

      const openOrder = await tx.order.findFirst({ where: { tableSessionId: sessionId, status: "OPEN" } });
      if (openOrder) {
        throw new TableSessionError("SESSION_HAS_OPEN_ORDER", "โต๊ะนี้ยังมีออเดอร์ค้างอยู่");
      }

      const closed = await tx.tableSession.update({
        where: { id: sessionId },
        data: { status: "CLOSED", endedAt: new Date() },
      });
      return { session: closed, alreadyClosed: false as const };
    });

    return { success: true, session: toSnapshot(result.session), alreadyClosed: result.alreadyClosed };
  } catch (err) {
    if (err instanceof TableSessionError) throw err;
    throw new TableSessionError("UNKNOWN_ERROR", "ปิด session ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  }
}
