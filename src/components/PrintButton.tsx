"use client";

export function PrintButton({ label = "พิมพ์" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print bg-black text-white rounded-lg px-4 py-2 font-medium"
    >
      {label}
    </button>
  );
}
