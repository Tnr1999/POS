import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { supportsCustomization } from "@/lib/menuOptions";
import { OrderClient } from "./OrderClient";
import { placeOrder } from "./actions";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const table = await prisma.table.findUnique({ where: { token } });
  if (!table) notFound();

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: { where: { active: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const uncategorized = await prisma.menuItem.findMany({
    where: { active: true, categoryId: null },
    orderBy: { createdAt: "asc" },
  });

  function toClientItem(item: (typeof categories)[number]["menuItems"][number], categoryName: string | null) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      trackStock: item.trackStock,
      stock: item.stock,
      isFeatured: item.isFeatured,
      supportsCustomization: supportsCustomization(categoryName),
    };
  }

  const menuGroups = [
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.menuItems.map((item) => toClientItem(item, c.name)),
    })),
    ...(uncategorized.length > 0
      ? [{ id: "uncategorized", name: "อื่น ๆ", items: uncategorized.map((item) => toClientItem(item, null)) }]
      : []),
  ].filter((g) => g.items.length > 0);

  const order = await prisma.order.findFirst({
    where: { tableId: table.id, status: "OPEN" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <OrderClient
      token={token}
      tableName={table.name}
      menuGroups={menuGroups}
      initialOrder={
        order
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
          : null
      }
      placeOrder={placeOrder}
    />
  );
}
