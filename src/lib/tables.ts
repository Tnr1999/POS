import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Table identity (name/token) only changes via explicit admin actions
 * (create/delete/regenerate QR) — never as a byproduct of order traffic.
 * Whether a table currently has an open order is intentionally NOT part
 * of this cached shape (that changes continuously during service); callers
 * needing that must query it separately, uncached, and combine in memory.
 * Invalidated via revalidateTag("tables") in createTable/deleteTable/
 * regenerateTableToken (admin/tables/actions.ts).
 */
export const getTables = unstable_cache(
  async () => {
    const tables = await prisma.table.findMany({ orderBy: { createdAt: "asc" } });
    return tables.map((t) => ({ id: t.id, name: t.name, token: t.token }));
  },
  ["tables-list"],
  { tags: ["tables"] }
);

export type ActiveSessionInfo = {
  id: string;
  token: string;
  status: string;
  startedAt: Date;
  hasOpenOrder: boolean;
};

export type TableWithSession = {
  id: string;
  name: string;
  token: string;
  activeSession: ActiveSessionInfo | null;
};

/**
 * Table Session state (Phase 2D.3) is live service state — staff opening/
 * closing rounds, customers placing orders — so unlike getTables() above,
 * this is deliberately NOT wrapped in unstable_cache: it must always
 * reflect the current DB state on every call. Returns only what the admin
 * UI needs to render session status, never the full Order/OrderItem rows.
 */
export async function getTablesWithSessions(): Promise<TableWithSession[]> {
  const tables = await prisma.table.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sessions: {
        where: { status: "ACTIVE" },
        take: 1,
        include: {
          orders: { where: { status: "OPEN" }, take: 1, select: { id: true } },
        },
      },
    },
  });

  return tables.map((table) => {
    const session = table.sessions[0];
    return {
      id: table.id,
      name: table.name,
      token: table.token,
      activeSession: session
        ? {
            id: session.id,
            token: session.token,
            status: session.status,
            startedAt: session.startedAt,
            hasOpenOrder: session.orders.length > 0,
          }
        : null,
    };
  });
}

/**
 * The token a customer-facing order QR must encode for this table right
 * now: the ACTIVE TableSession's token, or null if there is no ACTIVE
 * session to order into. Never Table.token (see its doc comment in
 * prisma/schema.prisma) — there is no fallback here on purpose. Shared by
 * /admin/tables (live QR) and /admin/tables/print (printed QR sheet) so
 * both derive the same value the same way.
 */
export function currentOrderTokenFor(table: Pick<TableWithSession, "activeSession">): string | null {
  return table.activeSession?.token ?? null;
}
