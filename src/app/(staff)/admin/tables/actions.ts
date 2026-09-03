"use server";

import { revalidatePath, updateTag } from "next/cache";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function createTable(formData: FormData) {
  await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.table.create({ data: { name, token: nanoid(12) } });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}

export async function regenerateTableToken(tableId: string) {
  await requireStaff();
  await prisma.table.update({
    where: { id: tableId },
    data: { token: nanoid(12) },
  });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}

export async function deleteTable(tableId: string) {
  await requireStaff();
  const openOrder = await prisma.order.findFirst({
    where: { tableId, status: "OPEN" },
  });
  if (openOrder) {
    throw new Error("ไม่สามารถลบโต๊ะที่มีออเดอร์ค้างอยู่ได้ กรุณาปิดบิลก่อน");
  }
  await prisma.table.delete({ where: { id: tableId } });
  updateTag("tables");
  revalidatePath("/admin/tables");
  revalidatePath("/admin/tables/print");
}
