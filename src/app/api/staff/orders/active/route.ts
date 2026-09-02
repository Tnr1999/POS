import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.order.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: {
      table: true,
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      type: order.type,
      tableName: order.table?.name ?? null,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        status: i.status,
      })),
    })),
  });
}
