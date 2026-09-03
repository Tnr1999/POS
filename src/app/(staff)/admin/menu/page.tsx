import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/categories";
import { MenuAdminClient } from "./MenuAdminClient";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  toggleMenuItemActive,
  updateMenuItem,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function MenuAdminPage() {
  // Independent queries — categories (cached, rarely changes) and the full
  // item list (always fresh: price/stock/active are correctness-sensitive)
  // run in parallel instead of two sequential round trips.
  const [categories, allItems] = await Promise.all([
    getCategories(),
    prisma.menuItem.findMany({
      orderBy: { createdAt: "asc" },
      include: { category: { select: { name: true } } },
    }),
  ]);

  const itemCountByCategory = new Map<string, number>();
  const items = allItems.map(({ category, ...item }) => {
    if (item.categoryId) {
      itemCountByCategory.set(item.categoryId, (itemCountByCategory.get(item.categoryId) ?? 0) + 1);
    }
    return { ...item, categoryName: category?.name ?? null };
  });

  return (
    <MenuAdminClient
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        itemCount: itemCountByCategory.get(c.id) ?? 0,
      }))}
      items={items}
      createCategory={createCategory}
      deleteCategory={deleteCategory}
      createMenuItem={createMenuItem}
      updateMenuItem={updateMenuItem}
      toggleMenuItemActive={toggleMenuItemActive}
      deleteMenuItem={deleteMenuItem}
    />
  );
}
