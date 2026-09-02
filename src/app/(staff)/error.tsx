"use client";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-md mx-auto mt-16 bg-white rounded-xl shadow p-6 text-center space-y-4">
      <p className="text-red-600 font-medium">{error.message || "เกิดข้อผิดพลาด"}</p>
      <button
        onClick={reset}
        className="bg-black text-white rounded-lg px-4 py-2 font-medium"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
}
