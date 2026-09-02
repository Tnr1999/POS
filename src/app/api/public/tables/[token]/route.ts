import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const order = await prisma.order.findFirst({
    where: { tableId: table.id, status: "OPEN" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

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
  });
}
