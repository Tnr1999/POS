"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * Same visual language as `Modal` but shaped for longer, form-heavy content
 * (e.g. editing a menu item): a bottom sheet on mobile, a full-height side
 * panel sliding in from the right on desktop, rather than a small centered
 * card.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
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
    <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card fixed bottom-0 left-0 right-0 sm:left-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full w-full sm:w-full sm:max-w-md rounded-b-none sm:rounded-none max-h-[92vh] sm:max-h-none overflow-y-auto p-5 space-y-4 animate-[drawer-in_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between gap-2 sticky -top-5 -mx-5 -mt-5 px-5 pt-5 pb-3 bg-(--surface) z-10">
            <h2 className="section-title text-(--foreground)">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="shrink-0 w-9 h-9 min-h-0 flex items-center justify-center rounded-full hover:bg-(--surface-muted) text-(--text-muted)"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
      <style>{`
        @keyframes drawer-in {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes drawer-in {
            from { transform: translateX(24px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
