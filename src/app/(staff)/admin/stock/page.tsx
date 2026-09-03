import { prisma } from "@/lib/prisma";
import { StockClient } from "./StockClient";
import { restockItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const [trackedItems, movements] = await Promise.all([
    prisma.menuItem.findMany({
      where: { trackStock: true },
      orderBy: { stock: "asc" },
    }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { menuItem: { select: { name: true } } },
    }),
  ]);

  return (
    <StockClient
      trackedItems={trackedItems.map((item) => ({
        id: item.id,
        name: item.name,
        stock: item.stock,
        trackStock: item.trackStock,
      }))}
      movements={movements.map((m) => ({
        id: m.id,
        type: m.type,
        qtyChange: m.qtyChange,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        itemName: m.menuItem.name,
      }))}
      restockItem={restockItem}
    />
  );
}
