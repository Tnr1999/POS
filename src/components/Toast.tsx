"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";
type ToastItem = { id: number; message: string; type: ToastType };

let counter = 0;
let listeners: ((item: ToastItem) => void)[] = [];

/** Fire a toast from anywhere (client components/handlers) — no provider/context needed. */
export function toast(message: string, type: ToastType = "success") {
  const item: ToastItem = { id: ++counter, message, type };
  listeners.forEach((listen) => listen(item));
}

/** Mount once near the root layout. Renders whatever toast() fires. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handle(item: ToastItem) {
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }, 3500);
    }
    listeners.push(handle);
    return () => {
      listeners = listeners.filter((l) => l !== handle);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            item.type === "error" ? "bg-red-600" : "bg-(--accent)"
          }`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
