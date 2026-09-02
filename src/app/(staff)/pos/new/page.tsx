import { prisma } from "@/lib/prisma";
import { createWalkInOrder } from "../actions";
import { NewOrderClient } from "./NewOrderClient";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      menuItems: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });
  const uncategorized = await prisma.menuItem.findMany({
    where: { active: true, categoryId: null },
    orderBy: { name: "asc" },
  });

  const menuGroups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: c.menuItems })),
    ...(uncategorized.length > 0
      ? [{ id: "uncategorized", name: "อื่น ๆ", items: uncategorized }]
      : []),
  ].filter((g) => g.items.length > 0);

  return <NewOrderClient menuGroups={menuGroups} createWalkInOrder={createWalkInOrder} />;
}
