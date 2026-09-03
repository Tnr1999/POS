"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";

/**
 * Customer-facing bottom sheet — deliberately its own component, not a
 * reuse of the staff app's Modal/Drawer. Warmer paper card, a drag-handle
 * bar instead of a title-bar close button as the primary affordance, and a
 * quick 200ms slide-up (never a slow admin-style transition).
 */
export function BottomSheet({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-[#2D2925]/45 animate-[sheet-scrim-in_180ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full sm:max-w-md bg-(--surface) rounded-t-[28px] shadow-[0_-8px_30px_rgb(0_0_0_/_0.18)] max-h-[88vh] overflow-y-auto animate-[sheet-slide-up_200ms_cubic-bezier(0.22,1,0.36,1)]"
      >
        <div className="sticky top-0 z-10 bg-(--surface) flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1.5 rounded-full bg-(--surface-border)" />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-(--surface-muted) flex items-center justify-center text-(--text-muted) z-10"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
        <div className="px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
      <style>{`
        @keyframes sheet-scrim-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sheet-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}
