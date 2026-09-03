"use client";

import { EmptyPlateDoodle } from "./illustrations";

export default function OrderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
      <EmptyPlateDoodle className="w-24 h-24" />
      <h1 className="page-heading text-xl">ไม่สามารถโหลดเมนูได้</h1>
      <p className="text-(--text-muted)">ขออภัยในความไม่สะดวก ลองอีกครั้งได้เลยค่ะ</p>
      <button
        type="button"
        onClick={reset}
        className="bg-(--brand) text-(--brand-foreground) rounded-full px-6 py-3 font-semibold"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}
