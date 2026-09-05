"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "./Toast";
import { Modal } from "./Modal";
import { Button, type ButtonVariant } from "./Button";

type Tone = "danger" | "warning" | "neutral";

const TONE_VARIANT: Record<Tone, ButtonVariant> = {
  danger: "danger",
  warning: "warning",
  neutral: "accent",
};

/**
 * Button that opens a styled confirm dialog (built on the shared `Modal`)
 * before running a (typically destructive) server action, instead of firing
 * on click or relying on the native `confirm()`. Shows a toast if the
 * action throws — e.g. a server action that rejects a delete because of
 * related open orders.
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
  disabled = false,
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
  disabled?: boolean;
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
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${className} disabled:opacity-50`}
      >
        {children}
      </button>
      <Modal open={open} onClose={() => !isPending && setOpen(false)} title={confirmTitle}>
        <p className="text-sm text-(--text-muted)">{confirmMessage}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button variant={TONE_VARIANT[tone]} size="sm" disabled={isPending} onClick={handleConfirm}>
            {isPending ? "กำลังทำรายการ..." : confirmLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
