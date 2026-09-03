import { EmptyPlateDoodle } from "./illustrations";

export default function OrderNotFound() {
  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <EmptyPlateDoodle className="w-24 h-24" />
      <h1 className="page-heading text-xl">ไม่พบโต๊ะนี้</h1>
      <p className="text-(--text-muted)">
        ลิงก์นี้อาจหมดอายุแล้ว กรุณาสแกน QR code ที่โต๊ะของคุณอีกครั้ง
      </p>
    </div>
  );
}
