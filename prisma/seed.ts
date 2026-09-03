import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const drinks = await prisma.category.upsert({
    where: { id: "cat-drinks" },
    update: { name: "เครื่องดื่ม", sortOrder: 1 },
    create: { id: "cat-drinks", name: "เครื่องดื่ม", sortOrder: 1 },
  });
  const food = await prisma.category.upsert({
    where: { id: "cat-food" },
    update: { name: "อาหารจานเดียว", sortOrder: 0 },
    create: { id: "cat-food", name: "อาหารจานเดียว", sortOrder: 0 },
  });

  const menuItems = [
    {
      id: "item-fried-rice",
      name: "ข้าวผัดหมู",
      description: "ข้าวผัดหอม ๆ คลุกเคล้ากับหมูสับ ไข่ และผักสด เสิร์ฟร้อน ๆ",
      price: 5000,
      categoryId: food.id,
      isFeatured: true,
    },
    {
      id: "item-pad-thai",
      name: "ผัดไทย",
      description: "เส้นจันท์ผัดรสเปรี้ยวหวานกำลังดี ใส่กุ้งสด ถั่วงอก และไข่",
      price: 6000,
      categoryId: food.id,
      isFeatured: true,
    },
    {
      id: "item-som-tum",
      name: "ส้มตำ",
      description: "ส้มตำมะละกอรสแซ่บ เผ็ดปรับได้ตามใจคนกิน",
      price: 4500,
      categoryId: food.id,
      isFeatured: false,
    },
    {
      id: "item-tea",
      name: "ชาเย็น",
      description: "ชาไทยเข้มข้น หวานมัน เสิร์ฟเย็นชื่นใจ",
      price: 2500,
      categoryId: drinks.id,
      isFeatured: false,
    },
    {
      id: "item-water",
      name: "น้ำเปล่า",
      description: null,
      price: 1000,
      categoryId: drinks.id,
      isFeatured: false,
    },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }

  const tables = [
    { id: "table-1", name: "โต๊ะ 1" },
    { id: "table-2", name: "โต๊ะ 2" },
    { id: "table-3", name: "โต๊ะ 3" },
  ];

  for (const table of tables) {
    await prisma.table.upsert({
      where: { id: table.id },
      update: {},
      create: { ...table, token: nanoid(12) },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
