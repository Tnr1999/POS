import { prisma } from "@/lib/prisma";
import { formatBaht } from "@/lib/money";
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">จัดการเมนู</h1>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">เพิ่มหมวดหมู่</h2>
        <form action={createCategory} className="flex gap-2">
          <input
            name="name"
            placeholder="ชื่อหมวดหมู่ เช่น อาหาร, เครื่องดื่ม"
            required
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button className="bg-black text-white rounded-lg px-4 py-2 font-medium">
            เพิ่ม
          </button>
        </form>
      </section>

      <section className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">เพิ่มเมนู</h2>
        <form action={createMenuItem} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            name="name"
            placeholder="ชื่อเมนู"
            required
            className="border rounded-lg px-3 py-2 sm:col-span-2"
          />
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="ราคา (บาท)"
            required
            className="border rounded-lg px-3 py-2"
          />
          <select name="categoryId" className="border rounded-lg px-3 py-2">
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="bg-black text-white rounded-lg px-4 py-2 font-medium sm:col-span-4">
            เพิ่มเมนู
          </button>
        </form>
      </section>

      {categories.map((category) => (
        <section key={category.id} className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{category.name}</h2>
            <form
              action={async () => {
                "use server";
                await deleteCategory(category.id);
              }}
            >
              <button className="text-sm text-red-600 hover:underline">
                ลบหมวดหมู่
              </button>
            </form>
          </div>
          <MenuItemList items={category.menuItems} categories={categories} />
        </section>
      ))}

      {uncategorized.length > 0 && (
        <section className="bg-white rounded-xl shadow p-4 space-y-3">
          <h2 className="font-semibold">ไม่มีหมวดหมู่</h2>
          <MenuItemList items={uncategorized} categories={categories} />
        </section>
      )}
    </div>
  );
}

function MenuItemList({
  items,
  categories,
}: {
  items: { id: string; name: string; price: number; active: boolean; categoryId: string | null }[];
  categories: { id: string; name: string }[];
}) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <li key={item.id} className="py-3">
          <form action={updateMenuItem} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
            <input type="hidden" name="id" value={item.id} />
            <input
              name="name"
              defaultValue={item.name}
              className="border rounded-lg px-3 py-2 sm:col-span-2"
            />
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(item.price / 100).toString()}
              className="border rounded-lg px-3 py-2"
            />
            <select
              name="categoryId"
              defaultValue={item.categoryId ?? ""}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">ไม่มีหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm">
                บันทึก
              </button>
            </div>
          </form>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="text-gray-500">{formatBaht(item.price)} บาท</span>
            <form
              action={async () => {
                "use server";
                await toggleMenuItemActive(item.id, !item.active);
              }}
            >
              <button
                className={
                  item.active
                    ? "text-amber-600 hover:underline"
                    : "text-green-600 hover:underline"
                }
              >
                {item.active ? "ปิดขายชั่วคราว" : "เปิดขาย"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteMenuItem(item.id);
              }}
            >
              <button className="text-red-600 hover:underline">ลบ</button>
            </form>
            {!item.active && (
              <span className="text-gray-400">(ปิดขายอยู่ ลูกค้าจะไม่เห็นเมนูนี้)</span>
            )}
          </div>
        </li>
      ))}
      {items.length === 0 && (
        <li className="py-3 text-sm text-gray-400">ยังไม่มีเมนูในหมวดนี้</li>
      )}
    </ul>
  );
}
