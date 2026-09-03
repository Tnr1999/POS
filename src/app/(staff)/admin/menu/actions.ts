"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { toSatang } from "@/lib/money";

export async function createCategory(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.category.create({ data: { name } });
  updateTag("categories");
  revalidatePath("/admin/menu");
  revalidatePath("/pos/new");
}

export async function deleteCategory(categoryId: string) {
  await requireStaff();
  await prisma.menuItem.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id: categoryId } });
  updateTag("categories");
  revalidatePath("/admin/menu");
  revalidatePath("/pos/new");
}

export async function createMenuItem(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const priceBaht = Number(formData.get("price"));
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const trackStock = formData.get("trackStock") === "on";
  const stock = Math.max(0, Math.trunc(Number(formData.get("stock")) || 0));
  if (!name || !Number.isFinite(priceBaht) || priceBaht < 0) return;

  await prisma.menuItem.create({
    data: { name, price: toSatang(priceBaht), categoryId, imageUrl, trackStock, stock },
  });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
  revalidatePath("/pos/new");
}

export async function updateMenuItem(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceBaht = Number(formData.get("price"));
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;
  const trackStock = formData.get("trackStock") === "on";
  const stock = Math.max(0, Math.trunc(Number(formData.get("stock")) || 0));
  if (!id || !name || !Number.isFinite(priceBaht) || priceBaht < 0) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.menuItem.findUnique({ where: { id } });
    if (!existing) return;

    await tx.menuItem.update({
      where: { id },
      data: { name, price: toSatang(priceBaht), categoryId, imageUrl, trackStock, stock },
    });

    const diff = stock - existing.stock;
    if (trackStock && diff !== 0) {
      await tx.stockMovement.create({
        data: { menuItemId: id, type: "ADJUSTMENT", qtyChange: diff, note: "แก้ไขจากหน้าจัดการเมนู" },
      });
    }
  });
  revalidatePath("/admin/menu");
  revalidatePath("/admin/stock");
  revalidatePath("/pos");
  revalidatePath("/pos/new");
}

export async function toggleMenuItemActive(id: string, active: boolean) {
  await requireStaff();
  await prisma.menuItem.update({ where: { id }, data: { active } });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
  revalidatePath("/pos/new");
}

export async function deleteMenuItem(id: string) {
  await requireStaff();
  await prisma.menuItem.delete({ where: { id } });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
  revalidatePath("/pos/new");
}
