import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { supportsCustomization } from "@/lib/menuOptions";
import { resolveActiveSessionByToken } from "@/lib/tableSessionAccess";
import { OrderClient } from "./OrderClient";
import { placeOrder } from "./actions";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Phase 2D.4: `token` is a TableSession token, not a Table token — it
  // only grants access while that session is ACTIVE. An unknown token, a
  // CLOSED session's old token, and "the table has a different ACTIVE
  // session now" all land here identically as `null`, which renders the
  // same generic expired/unavailable state (not-found.tsx) — never a
  // fallback to the table's current session.
  const access = await resolveActiveSessionByToken(token);
  if (!access) notFound();

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
    where: { tableSessionId: access.sessionId, status: "OPEN" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <OrderClient
      token={token}
      tableName={access.tableName}
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
