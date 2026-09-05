"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatBaht, toBaht } from "@/lib/money";
import { toast } from "@/components/Toast";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { SearchInput } from "@/components/SearchInput";
import { Drawer } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StockStatusBadge } from "@/components/StatusBadge";
import { MenuItemImage } from "@/components/MenuItemImage";
import { EditIcon, TrashIcon, PlusIcon } from "@/components/icons";

type CategorySummary = { id: string; name: string; itemCount: number };
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  active: boolean;
  isFeatured: boolean;
  trackStock: boolean;
  stock: number;
  categoryId: string | null;
  categoryName: string | null;
};

type FormState = { mode: "create" } | { mode: "edit"; item: MenuItem } | null;

export function MenuAdminClient({
  categories,
  items,
  createCategory,
  deleteCategory,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemActive,
  deleteMenuItem,
}: {
  categories: CategorySummary[];
  items: MenuItem[];
  createCategory: (formData: FormData) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  createMenuItem: (formData: FormData) => Promise<void>;
  updateMenuItem: (formData: FormData) => Promise<void>;
  toggleMenuItemActive: (id: string, active: boolean) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [formState, setFormState] = useState<FormState>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (categoryFilter === "none" && item.categoryId !== null) return false;
      if (categoryFilter !== "all" && categoryFilter !== "none" && item.categoryId !== categoryFilter)
        return false;
      if (availability === "active" && !item.active) return false;
      if (availability === "inactive" && item.active) return false;
      return true;
    });
  }, [items, query, categoryFilter, availability]);

  function handleToggleActive(item: MenuItem) {
    startTransition(async () => {
      try {
        await toggleMenuItemActive(item.id, !item.active);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ", "error");
      }
    });
  }

  function handleDelete(item: MenuItem) {
    return async () => {
      await deleteMenuItem(item.id);
      router.refresh();
    };
  }

  function handleFormSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const action = formState?.mode === "edit" ? updateMenuItem : createMenuItem;
    startTransition(async () => {
      try {
        await action(formData);
        setFormState(null);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "บันทึกเมนูไม่สำเร็จ", "error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">จัดการเมนู</h1>
        <Button variant="primary" onClick={() => setFormState({ mode: "create" })}>
          <PlusIcon className="w-4 h-4" />
          เพิ่มเมนู
        </Button>
      </div>

      <section className="card p-4 space-y-3">
        <h2 className="section-title">หมวดหมู่</h2>
        <form action={createCategory} className="flex gap-2">
          <Input name="name" placeholder="ชื่อหมวดหมู่ เช่น อาหาร, เครื่องดื่ม" required className="flex-1" />
          <Button type="submit" variant="accent" size="sm">
            เพิ่ม
          </Button>
        </form>
        {categories.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="chip chip-neutral inline-flex items-center gap-1.5 pr-1.5">
                <span>
                  {c.name} ({c.itemCount})
                </span>
                <ConfirmButton
                  action={() => deleteCategory(c.id)}
                  confirmTitle="ลบหมวดหมู่"
                  confirmMessage={`ลบหมวดหมู่ "${c.name}"? เมนู ${c.itemCount} รายการในหมวดนี้จะกลายเป็น "ไม่มีหมวดหมู่" (ไม่ถูกลบ)`}
                  confirmLabel="ลบหมวดหมู่"
                  className="text-(--text-muted-2) hover:text-(--text-danger) min-w-11 min-h-11 inline-flex items-center justify-center"
                  onSuccess={() => router.refresh()}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span className="sr-only">ลบหมวดหมู่ {c.name}</span>
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-2">
        <SearchInput
          placeholder="ค้นหาเมนู..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="sm:w-48"
            aria-label="กรองตามหมวดหมู่"
          >
            <option value="all">ทุกหมวดหมู่</option>
            <option value="none">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="sm:w-40"
            aria-label="กรองสถานะการขาย"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">เปิดขาย</option>
            <option value="inactive">ปิดขาย</option>
          </Select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "ยังไม่มีเมนู" : "ไม่พบเมนูที่ค้นหา"}
          description={
            items.length === 0
              ? "เริ่มเพิ่มเมนูแรกของร้านได้เลย"
              : "ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง"
          }
          action={
            items.length === 0 ? (
              <Button variant="primary" size="sm" onClick={() => setFormState({ mode: "create" })}>
                เพิ่มเมนู
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              isPending={isPending}
              onEdit={() => setFormState({ mode: "edit", item })}
              onToggleActive={() => handleToggleActive(item)}
              onDelete={handleDelete(item)}
            />
          ))}
        </div>
      )}

      <Drawer
        open={formState !== null}
        onClose={() => setFormState(null)}
        title={formState?.mode === "edit" ? "แก้ไขเมนู" : "เพิ่มเมนู"}
      >
        {formState && (
          <MenuItemForm
            key={formState.mode === "edit" ? formState.item.id : "create"}
            item={formState.mode === "edit" ? formState.item : undefined}
            categories={categories}
            isPending={isPending}
            onSubmit={handleFormSubmit}
          />
        )}
      </Drawer>
    </div>
  );
}

function MenuItemCard({
  item,
  isPending,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  item: MenuItem;
  isPending: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className={`card overflow-hidden flex flex-col ${item.active ? "" : "opacity-60"}`}>
      <MenuItemImage src={item.imageUrl}>
        {!item.active && (
          <span className="absolute top-2 left-2 chip chip-neutral">ปิดขาย</span>
        )}
        {item.active && item.isFeatured && (
          <span className="absolute top-2 left-2 chip chip-gold">แนะนำ</span>
        )}
      </MenuItemImage>
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <p className="card-title leading-snug line-clamp-2 min-h-[2.5em]">{item.name}</p>
        {item.categoryName && (
          <span className="text-xs text-(--text-muted-2)">{item.categoryName}</span>
        )}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold">{formatBaht(item.price)} บาท</span>
          <StockStatusBadge item={item} showQty />
        </div>
        <div className="flex items-center gap-1 pt-2 mt-auto border-t border-(--surface-border)">
          <button
            type="button"
            disabled={isPending}
            onClick={onEdit}
            aria-label={`แก้ไข ${item.name}`}
            className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium rounded-lg hover:bg-(--surface-muted) disabled:opacity-50"
          >
            <EditIcon className="w-3.5 h-3.5" />
            แก้ไข
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onToggleActive}
            className={`flex-1 py-2 text-xs font-medium rounded-lg hover:bg-(--surface-muted) disabled:opacity-50 ${
              item.active ? "text-(--text-warning)" : "text-(--text-success)"
            }`}
          >
            {item.active ? "ปิดขาย" : "เปิดขาย"}
          </button>
          <ConfirmButton
            action={onDelete}
            confirmTitle="ลบเมนู"
            confirmMessage={`ลบเมนู "${item.name}"? ลบแล้วกู้คืนไม่ได้`}
            confirmLabel="ลบเมนู"
            disabled={isPending}
            className="p-2 rounded-lg text-(--text-danger) hover:bg-(--surface-muted)"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            <span className="sr-only">ลบ {item.name}</span>
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}

function MenuItemForm({
  item,
  categories,
  isPending,
  onSubmit,
}: {
  item?: MenuItem;
  categories: CategorySummary[];
  isPending: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="menu-item-name">
          ชื่อเมนู
        </label>
        <Input id="menu-item-name" name="name" defaultValue={item?.name} required />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="menu-item-description">
          คำอธิบาย (ไม่บังคับ)
        </label>
        <textarea
          id="menu-item-description"
          name="description"
          defaultValue={item?.description ?? ""}
          rows={2}
          maxLength={200}
          placeholder="เช่น หมูกรอบกรุบ ๆ ผัดกับกะเพรา เสิร์ฟพร้อมไข่ดาว"
          className="w-full rounded-lg border border-(--surface-border) bg-(--surface) px-3 py-2 placeholder:text-(--text-muted-2) focus:outline-none focus:ring-2 focus:ring-(--brand) resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="menu-item-price">
            ราคา (บาท)
          </label>
          <Input
            id="menu-item-price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item ? toBaht(item.price) : undefined}
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1" htmlFor="menu-item-category">
            หมวดหมู่
          </label>
          <Select id="menu-item-category" name="categoryId" defaultValue={item?.categoryId ?? ""}>
            <option value="">ไม่มีหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="menu-item-image">
          ลิงก์รูปภาพ (ไม่บังคับ)
        </label>
        <Input
          id="menu-item-image"
          name="imageUrl"
          type="url"
          defaultValue={item?.imageUrl ?? ""}
          placeholder="https://..."
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="trackStock"
          defaultChecked={item?.trackStock ?? false}
          className="w-4 h-4"
        />
        ตัดสต็อกอัตโนมัติเมื่อขาย
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isFeatured"
          defaultChecked={item?.isFeatured ?? false}
          className="w-4 h-4"
        />
        แนะนำเมนูนี้ (แสดงในหน้า &quot;เมนูแนะนำ&quot; ของลูกค้า)
      </label>
      <div>
        <label className="text-sm font-medium block mb-1" htmlFor="menu-item-stock">
          จำนวนสต็อก
        </label>
        <Input
          id="menu-item-stock"
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={item?.stock ?? 0}
        />
      </div>
      <Button type="submit" variant="primary" fullWidth disabled={isPending}>
        {isPending ? "กำลังบันทึก..." : item ? "บันทึกการแก้ไข" : "เพิ่มเมนู"}
      </Button>
    </form>
  );
}
