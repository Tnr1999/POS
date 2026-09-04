import { EmptyPlateDoodle } from "./illustrations";

export default function OrderNotFound() {
  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <EmptyPlateDoodle className="w-24 h-24" />
      <h1 className="page-heading text-xl">QR นี้หมดอายุแล้ว</h1>
      <p className="text-(--text-muted)">กรุณาสแกน QR ใหม่จากโต๊ะ</p>
    </div>
  );
}
