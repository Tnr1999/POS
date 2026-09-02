# POS + สั่งอาหารผ่าน QR code

ระบบขายหน้าร้าน (POS) แบบเว็บแอปที่ใช้ฟรีทั้งหมด สำหรับร้านอาหาร:

- ลูกค้าสแกน QR code ที่โต๊ะ → ดูเมนู → สั่งอาหารเองจากมือถือ
- ออเดอร์เข้าหน้าจอพนักงาน (POS) แบบเรียลไทม์ (อัปเดตอัตโนมัติทุก 4-5 วินาที)
- พนักงานติดตามสถานะอาหาร (รอทำ → กำลังทำ → เสิร์ฟแล้ว), เพิ่มออเดอร์หน้าร้าน/กลับบ้านเองได้
- ปิดบิลแล้วพิมพ์ใบเสร็จ (รองรับเครื่องพิมพ์ใบเสร็จความร้อน 80mm ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์)
- จัดการเมนู/หมวดหมู่/โต๊ะ + สร้าง QR code ให้แต่ละโต๊ะ พร้อมหน้าพิมพ์ QR รวม
- รายงานยอดขายรายวัน + เมนูขายดี
- ใช้งานผ่านมือถือ/แท็บเล็ตได้ดี ทั้งฝั่งลูกค้าและฝั่งพนักงาน

สแตกที่ใช้ (ฟรีทั้งหมด): **Next.js** (App Router) + **Prisma** + **PostgreSQL** + **Tailwind CSS**
เดพลอยฟรีบน **Vercel** (hosting) + **Supabase** (ฐานข้อมูล Postgres)

## เริ่มต้นใช้งาน (รันในเครื่อง)

ต้องมี [Node.js](https://nodejs.org) 20+ และฐานข้อมูล Postgres ไว้ทดสอบ (จะใช้ Postgres ในเครื่อง หรือสร้างโปรเจกต์ Supabase ฟรีแล้วชี้มาที่นั่นเลยก็ได้ — ดูขั้นตอนด้านล่าง)

```bash
npm install
cp .env.example .env   # แล้วแก้ DATABASE_URL/DIRECT_URL ให้ชี้ไปที่ฐานข้อมูลจริง + แก้รหัสผ่าน/ความลับ
npx prisma migrate deploy
npx prisma db seed      # ใส่ข้อมูลตัวอย่าง (เมนู 5 รายการ, โต๊ะ 3 โต๊ะ) จะได้ทดลองใช้ได้ทันที
npm run dev
```

เปิด http://localhost:3000 — ระบบจะพาไปหน้า `/pos` (ต้องล็อกอินด้วยรหัสผ่านจาก `ADMIN_PASSWORD` ใน `.env`)

**สำคัญ**: แก้ค่าเหล่านี้ใน `.env` ก่อนใช้งานจริง
- `DATABASE_URL` / `DIRECT_URL` — connection string ของฐานข้อมูล Postgres (ดูวิธีตั้งค่ากับ Supabase ด้านล่าง)
- `ADMIN_PASSWORD` — รหัสผ่านพนักงาน
- `AUTH_SECRET` — ตั้งเป็นข้อความยาวๆ สุ่มๆ (ใช้เซ็นคุกกี้ล็อกอิน)
- `NEXT_PUBLIC_BASE_URL` — โดเมนจริงของร้าน (ใช้สร้างลิงก์ใน QR code ให้ลูกค้าสแกน)
- `NEXT_PUBLIC_SHOP_NAME` — ชื่อร้านที่จะพิมพ์บนใบเสร็จ

## วิธีใช้งาน

1. ไปที่ **จัดการเมนู** (`/admin/menu`) เพิ่มหมวดหมู่และเมนูอาหาร/เครื่องดื่ม พร้อมราคา
2. ไปที่ **จัดการโต๊ะ / QR** (`/admin/tables`) เพิ่มโต๊ะ แล้วกด "พิมพ์ QR ทุกโต๊ะ" เพื่อพิมพ์และแปะที่โต๊ะแต่ละโต๊ะ
3. ลูกค้าสแกน QR ที่โต๊ะ → เลือกเมนู → กดสั่งอาหาร
4. ออเดอร์จะขึ้นที่หน้า **หน้าขาย** (`/pos`) ให้พนักงานอัปเดตสถานะอาหาร และกด "ชำระเงิน / พิมพ์บิล" เมื่อลูกค้าจะจ่ายเงิน จะพาไปหน้าใบเสร็จให้กดพิมพ์
5. ออเดอร์หน้าร้าน/กลับบ้านที่ไม่ผ่าน QR ให้พนักงานสร้างเองที่ปุ่ม "+ ออเดอร์ใหม่" ในหน้าขาย
6. ดูยอดขายที่ **รายงานยอดขาย** (`/reports`)

## การพิมพ์ใบเสร็จ

ใช้วิธีพิมพ์ผ่านเบราว์เซอร์ (`window.print()`) กับหน้าใบเสร็จที่จัดขนาดไว้สำหรับกระดาษความร้อน 80mm ซึ่งใช้ได้ฟรีกับ:
- เครื่องพิมพ์ใบเสร็จความร้อน (thermal receipt printer) ที่ติดตั้งไดรเวอร์เป็นเครื่องพิมพ์ปกติของเครื่อง (USB/Bluetooth ส่วนใหญ่รองรับ)
- หรือพิมพ์ลงกระดาษ A4/เครื่องพิมพ์ทั่วไปก็ได้เช่นกัน

ไม่ต้องติดตั้งไลบรารีหรือ SDK เพิ่มเติม ไม่มีค่าใช้จ่าย

## Deploy ฟรีด้วย Vercel + Supabase

### 1. สร้างฐานข้อมูลที่ Supabase (ฟรี)

1. สมัคร/ล็อกอินที่ [supabase.com](https://supabase.com) แล้วสร้างโปรเจกต์ใหม่ (free tier)
2. ไปที่ **Project Settings → Database → Connection string**
3. คัดลอก 2 ค่านี้มาเตรียมไว้ (**ห้ามใช้แท็บ "Direct connection"** — host นั้น (`db.<ref>.supabase.co`) รองรับ IPv6 อย่างเดียวโดย default ซึ่ง Vercel build ต่อไม่ได้ จะ error `P1001: Can't reach database server`):
   - แท็บ **Transaction pooler** (พอร์ต `6543`) → ใช้เป็น `DATABASE_URL` (แอปใช้เชื่อมต่อตอนรันจริง)
   - แท็บ **Session pooler** (host เดียวกับ Transaction pooler แต่พอร์ต `5432`) → ใช้เป็น `DIRECT_URL` (ใช้ตอนรัน migration เท่านั้น)
4. รัน migration เข้าฐานข้อมูลจริงจากเครื่องตัวเอง (ครั้งแรกครั้งเดียว หรือทุกครั้งที่แก้ schema):
   ```bash
   DATABASE_URL="<transaction pooler url>" DIRECT_URL="<direct url>" npx prisma migrate deploy
   DATABASE_URL="<transaction pooler url>" npx prisma db seed   # ถ้าต้องการข้อมูลตัวอย่าง
   ```

### 2. Deploy เว็บแอปที่ Vercel (ฟรี)

1. Push โค้ดขึ้น GitHub แล้วไปที่ [vercel.com](https://vercel.com) → New Project → เลือก repo นี้
2. ตั้งค่า Environment Variables ในหน้าตั้งค่าโปรเจกต์ Vercel ให้ตรงกับ `.env.example`:
   - `DATABASE_URL` = Transaction pooler URL จาก Supabase (พอร์ต 6543)
   - `DIRECT_URL` = Session pooler URL จาก Supabase (host เดียวกัน พอร์ต 5432 - **ไม่ใช่** Direct connection)
   - `ADMIN_PASSWORD`, `AUTH_SECRET` = ตั้งค่าจริงของร้าน (อย่าใช้ค่าตัวอย่าง)
   - `NEXT_PUBLIC_BASE_URL` = โดเมนที่ Vercel ให้มา เช่น `https://your-shop.vercel.app`
   - `NEXT_PUBLIC_SHOP_NAME` = ชื่อร้าน
3. กด Deploy — ทุกครั้งที่ deploy ระบบจะรัน `prisma migrate deploy` ให้อัตโนมัติก่อน build (ดูใน `package.json` script `build`) ฐานข้อมูลจะอัปเดตตาม schema ล่าสุดเสมอ
4. เข้าเว็บที่โดเมนของ Vercel แล้วไปตั้งเมนู/โต๊ะได้เลย ทุกอย่างฟรี (Vercel free tier + Supabase free tier รองรับร้านขนาดเล็ก-กลางได้สบาย)

> ทางเลือกอื่นที่ไม่ต้องพึ่งคลาวด์เลย: รัน `npm run build && npm run start` บนคอมพิวเตอร์ในร้านเอง (ต้องมี Postgres รันอยู่ในเครื่องนั้นด้วย) แล้วให้มือถือลูกค้า/พนักงานเข้าผ่าน Wi-Fi วงเดียวกัน (ตั้ง `NEXT_PUBLIC_BASE_URL` เป็น IP เครื่องนั้น)

## โครงสร้างสิทธิ์การเข้าถึง

- `/order/[token]` — หน้าลูกค้า เปิดเผยสาธารณะ ไม่ต้องล็อกอิน (เข้าผ่าน QR เท่านั้น)
- `/pos`, `/admin/*`, `/reports`, `/receipt/*` — ต้องล็อกอินด้วยรหัสผ่านพนักงาน (`ADMIN_PASSWORD`)

## คำสั่งที่ใช้บ่อย

```bash
npm run dev              # รันโหมดพัฒนา
npm run build            # รัน migration ค้างอยู่ + build สำหรับ production
npm run start            # รันเซิร์ฟเวอร์ production (ต้อง build ก่อน)
npx prisma studio        # เปิดหน้าดู/แก้ข้อมูลในฐานข้อมูล
npx prisma migrate dev   # แก้ schema แล้วสร้าง migration ใหม่ (ใช้ตอนพัฒนา)
```
