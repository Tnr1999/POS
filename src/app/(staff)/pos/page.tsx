import { prisma } from "@/lib/prisma";
import { PosBoard } from "./PosBoard";
import { advanceOrderItemStatus, addItemToOrder, payOrder, cancelOrder } from "./actions";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const [orders, menuItems] = await Promise.all([
    prisma.order.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { table: true, items: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.menuItem.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const initialOrders = orders.map((order) => ({
    id: order.id,
    type: order.type,
    tableName: order.table?.name ?? null,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.qty,
      status: i.status,
    })),
  }));

  return (
    <PosBoard
      initialOrders={initialOrders}
      menuItems={menuItems
        .filter((m) => !m.trackStock || m.stock > 0)
        .map((m) => ({ id: m.id, name: m.name, price: m.price, trackStock: m.trackStock, stock: m.stock }))}
      advanceOrderItemStatus={advanceOrderItemStatus}
      addItemToOrder={addItemToOrder}
      payOrder={payOrder}
      cancelOrder={cancelOrder}
    />
  );
}
