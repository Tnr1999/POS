"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "./Toast";

type Tone = "danger" | "warning" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-red-600 hover:bg-red-700",
  warning: "bg-amber-600 hover:bg-amber-700",
  neutral: "bg-gray-800 hover:bg-gray-900",
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
  className = "text-sm text-red-600 hover:underline",
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
            className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="font-semibold text-gray-900">{confirmTitle}</h2>
              <p className="text-sm text-gray-500">{confirmMessage}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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
