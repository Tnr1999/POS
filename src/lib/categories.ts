import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Menu categories change only when staff explicitly add/remove one from
 * "จัดการเมนู" — never as a side effect of taking orders or adjusting stock.
 * Unlike menu items (price/stock/active), a category row carries no
 * dynamic/correctness-sensitive field, so caching it across requests is
 * safe. Invalidated explicitly via revalidateTag("categories") in
 * createCategory/deleteCategory (admin/menu/actions.ts).
 */
export const getCategories = unstable_cache(
  async () => {
    const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    return categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }));
  },
  ["categories-list"],
  { tags: ["categories"] }
);
