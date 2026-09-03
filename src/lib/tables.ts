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
