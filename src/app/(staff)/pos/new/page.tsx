import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/categories";
import { createWalkInOrder } from "../actions";
import { NewOrderClient } from "./NewOrderClient";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  // Categories (cached, rarely changes) and active menu items (always
  // fresh: price/stock are correctness-sensitive) are independent — fetch
  // in parallel instead of two sequential round trips.
  const [categories, activeItems] = await Promise.all([
    getCategories(),
    prisma.menuItem.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        trackStock: true,
        stock: true,
        categoryId: true,
      },
    }),
  ]);

  const itemsByCategory = new Map<string, typeof activeItems>();
  const uncategorizedItems: typeof activeItems = [];
  for (const item of activeItems) {
    if (item.categoryId) {
      const bucket = itemsByCategory.get(item.categoryId);
      if (bucket) bucket.push(item);
      else itemsByCategory.set(item.categoryId, [item]);
    } else {
      uncategorizedItems.push(item);
    }
  }

  const menuGroups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: itemsByCategory.get(c.id) ?? [] })),
    ...(uncategorizedItems.length > 0
      ? [{ id: "uncategorized", name: "อื่น ๆ", items: uncategorizedItems }]
      : []),
  ].filter((g) => g.items.length > 0);

  return <NewOrderClient menuGroups={menuGroups} createWalkInOrder={createWalkInOrder} />;
}
