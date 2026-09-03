"use client";

import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./icons";

/**
 * Centered card over a scrim on desktop, bottom-sheet slide-up on mobile —
 * one component, CSS-driven breakpoint switch, no new JS dependency.
 * `ConfirmButton` builds its confirm dialog on top of this so there's a
 * single modal implementation in the app.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
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

  const maxWidth = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[size];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-b-[20px] p-5 space-y-4 animate-[modal-in_0.18s_ease-out]`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between gap-2">
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
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (min-width: 640px) {
          @keyframes modal-in {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
          }
        }
      `}</style>
    </div>
  );
}
