"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { toSatang } from "@/lib/money";

export async function createCategory(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.category.create({ data: { name } });
  revalidatePath("/admin/menu");
}

export async function deleteCategory(categoryId: string) {
  await requireStaff();
  await prisma.menuItem.updateMany({
    where: { categoryId },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id: categoryId } });
  revalidatePath("/admin/menu");
}

export async function createMenuItem(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const priceBaht = Number(formData.get("price"));
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  if (!name || !Number.isFinite(priceBaht) || priceBaht < 0) return;

  await prisma.menuItem.create({
    data: { name, price: toSatang(priceBaht), categoryId },
  });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}

export async function updateMenuItem(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceBaht = Number(formData.get("price"));
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  if (!id || !name || !Number.isFinite(priceBaht) || priceBaht < 0) return;

  await prisma.menuItem.update({
    where: { id },
    data: { name, price: toSatang(priceBaht), categoryId },
  });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}

export async function toggleMenuItemActive(id: string, active: boolean) {
  await requireStaff();
  await prisma.menuItem.update({ where: { id }, data: { active } });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}

export async function deleteMenuItem(id: string) {
  await requireStaff();
  await prisma.menuItem.delete({ where: { id } });
  revalidatePath("/admin/menu");
  revalidatePath("/pos");
}
