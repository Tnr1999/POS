"use client";

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
      <button
        onClick={reset}
        className="bg-(--brand) text-(--brand-foreground) rounded-lg px-4 py-2 font-medium"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}
