"use client";

import { Button } from "@/components/Button";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto mt-16 card p-6 text-center space-y-4">
      <p className="text-(--text-danger) font-medium">{error.message || "เกิดข้อผิดพลาด"}</p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
    </div>
  );
}
