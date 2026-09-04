import { prisma } from "@/lib/prisma";

export type ActiveSessionAccess = {
  sessionId: string;
  tableId: string;
  tableName: string;
};

/**
 * Resolves a customer-facing QR token to the ACTIVE TableSession it grants
 * access to (Phase 2D.4) — read-only, for page rendering / polling, where
 * there is nothing to serialize against (no write happens here).
 *
 * Returns null whenever the token must be treated as invalid/expired:
 *   - no TableSession has this token at all (unknown/garbage token)
 *   - the TableSession exists but status !== "ACTIVE" (closed round)
 *
 * TableSession.token is unique and immutable once created, and a table's
 * old (closed) session keeps its own row forever — it is never reused or
 * repointed at whichever session is active now. So an old QR's token always
 * resolves back to its own now-CLOSED session, never to a newer ACTIVE one
 * on the same table: there is no fallback to "the table's current session"
 * anywhere in this lookup, and none must ever be added here.
 *
 * Never falls back to Table.token. Callers must treat a null result as a
 * generic expired/unavailable state and must not expose which of the above
 * cases occurred, nor any internal id.
 */
export async function resolveActiveSessionByToken(token: string): Promise<ActiveSessionAccess | null> {
  const session = await prisma.tableSession.findUnique({
    where: { token },
    include: { table: { select: { id: true, name: true } } },
  });
  if (!session || session.status !== "ACTIVE") return null;

  return {
    sessionId: session.id,
    tableId: session.table.id,
    tableName: session.table.name,
  };
}
