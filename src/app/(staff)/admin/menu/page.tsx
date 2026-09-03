import { prisma } from "@/lib/prisma";
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
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { menuItems: { orderBy: { createdAt: "asc" } } },
  });
  const uncategorized = await prisma.menuItem.findMany({
    where: { categoryId: null },
    orderBy: { createdAt: "asc" },
  });

  const items = [
    ...categories.flatMap((c) => c.menuItems.map((m) => ({ ...m, categoryName: c.name }))),
    ...uncategorized.map((m) => ({ ...m, categoryName: null as string | null })),
  ];

  return (
    <MenuAdminClient
      categories={categories.map((c) => ({ id: c.id, name: c.name, itemCount: c.menuItems.length }))}
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
