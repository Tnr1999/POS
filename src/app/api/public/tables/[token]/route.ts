import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveSessionByToken } from "@/lib/tableSessionAccess";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Phase 2D.4: same session-token resolution as the order page — an old
  // token whose session has since closed must keep returning not_found even
  // if the same physical table now has a different ACTIVE session; there is
  // deliberately no lookup-by-table fallback here.
  const access = await resolveActiveSessionByToken(token);
  if (!access) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [order, trackedItems] = await Promise.all([
    prisma.order.findFirst({
      where: { tableSessionId: access.sessionId, status: "OPEN" },
      include: { items: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.menuItem.findMany({
      where: { active: true, trackStock: true },
      select: { id: true, stock: true },
    }),
  ]);

  return NextResponse.json({
    order: order
      ? {
          id: order.id,
          status: order.status,
          items: order.items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            qty: i.qty,
            status: i.status,
          })),
        }
      : null,
    stock: Object.fromEntries(trackedItems.map((i) => [i.id, i.stock])),
  });
}
