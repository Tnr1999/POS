"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "./Toast";

type Tone = "danger" | "warning" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-red-600 hover:bg-red-700",
  // amber-600 only gives white button text 3.2:1 contrast — amber-700 clears
  // the 4.5:1 floor while still reading as "warning" (found during QA pass)
  warning: "bg-amber-700 hover:bg-amber-800",
  neutral: "bg-(--accent) hover:bg-(--accent-hover)",
};

/**
 * Button that opens a styled confirm dialog before running a (typically
 * destructive) server action, instead of firing on click or relying on the
 * native `confirm()`. Shows a toast if the action throws — e.g. a server
 * action that rejects a delete because of related open orders.
 */
export function ConfirmButton({
  action,
  confirmMessage,
  confirmTitle = "ยืนยันการทำรายการ",
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "danger",
  className = "text-sm text-(--text-danger) hover:underline",
  children,
  onSuccess,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
  confirmTitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await action();
        setOpen(false);
        onSuccess?.();
      } catch (err) {
        setOpen(false);
        toast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="card w-full max-w-sm space-y-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="font-semibold text-(--foreground)">{confirmTitle}</h2>
              <p className="text-sm text-(--text-muted)">{confirmMessage}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-(--text-subtle) hover:bg-(--surface-muted) disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${TONE_CLASSES[tone]}`}
              >
                {isPending ? "กำลังทำรายการ..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
