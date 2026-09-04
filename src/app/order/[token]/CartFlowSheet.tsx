"use client";

import { useRef, useState } from "react";
import { formatBaht } from "@/lib/money";
import { BottomSheet } from "./BottomSheet";
import { CelebrationBurst } from "./illustrations";
import type { CartEntry } from "./types";

type Step = "cart" | "confirm" | "sending" | "success";

export function CartFlowSheet({
  open,
  entries,
  tableName,
  onClose,
  onUpdateQty,
  onSubmit,
  onViewStatus,
}: {
  open: boolean;
  entries: CartEntry[];
  tableName: string;
  onClose: () => void;
  onUpdateQty: (key: string, qty: number) => void;
  onSubmit: (idempotencyKey: string) => Promise<{ unavailable: string[]; orderId: string | null }>;
  onViewStatus: () => void;
}) {
  const [step, setStep] = useState<Step>("cart");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);
  // Snapshot of count/subtotal taken the instant the user confirms — the
  // confirm/sending/success screens read from this, never live `entries`.
  // Without it, the parent clears the cart (setCartEntries([])) the moment
  // placeOrder succeeds, which is *before* this sheet's own step flips to
  // "success" — so the "กำลังส่ง..." screen would flash "0 รายการ / ฿0" for a
  // frame as the now-empty cart prop re-renders through it.
  const [snapshot, setSnapshot] = useState<{ count: number; subtotal: number } | null>(null);
  // One key per "ส่งออเดอร์" submission attempt (reused across retries of the
  // same attempt, cleared when the user goes back to edit the cart) so a
  // network retry or double-tap can't create duplicate order items — see
  // placeOrder's doc comment in actions.ts.
  const idempotencyKeyRef = useRef<string | null>(null);

  const liveCount = entries.reduce((sum, e) => sum + e.qty, 0);
  const liveSubtotal = entries.reduce((sum, e) => sum + e.unitPrice * e.qty, 0);
  const count = snapshot?.count ?? liveCount;
  const subtotal = snapshot?.subtotal ?? liveSubtotal;

  function handleClose() {
    onClose();
    // Reset back to the cart view for next time, after the close animation.
    setTimeout(() => {
      setStep("cart");
      setUnavailable([]);
      setSubmitError(false);
      setSnapshot(null);
      idempotencyKeyRef.current = null;
    }, 200);
  }

  async function handleConfirmSubmit() {
    setStep("sending");
    setSubmitError(false);
    // Lazily create the key on the first attempt, then reuse it for every
    // retry of this same submission so the server can recognize a retry.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    try {
      const result = await onSubmit(idempotencyKeyRef.current);
      if (result.unavailable.length > 0) {
        setUnavailable(result.unavailable);
        idempotencyKeyRef.current = null;
        setSnapshot(null);
        setStep("cart");
        return;
      }
      setOrderId(result.orderId);
      setStep("success");
    } catch {
      // Network/server hiccup — stay on the confirm step so the user can
      // retry with the same idempotency key instead of losing their cart.
      setSubmitError(true);
      setStep("confirm");
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} labelledBy="cart-sheet-title">
      {step === "cart" && (
        <div className="pt-3 space-y-4">
          <h2 id="cart-sheet-title" className="page-heading text-[1.375rem]">
            ตะกร้าของคุณ
          </h2>
          <p className="text-(--text-muted) text-sm -mt-2">{tableName}</p>

          {unavailable.length > 0 && (
            <div className="p-3 rounded-xl bg-red-100 text-(--text-danger) text-sm">
              ขออภัย {unavailable.join(", ")} หมดพอดี ไม่ได้ถูกเพิ่มในออเดอร์
            </div>
          )}

          {entries.length === 0 ? (
            <p className="text-center text-(--text-muted-2) py-8">ยังไม่มีรายการในตะกร้า</p>
          ) : (
            <ul className="divide-y divide-(--surface-border)">
              {entries.map((entry) => (
                <li key={entry.key} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{entry.name}</p>
                    {(entry.spiceLevel || entry.addOnNames.length > 0) && (
                      <p className="text-xs text-(--text-muted-2) mt-0.5">
                        {[entry.spiceLevel, ...entry.addOnNames].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-sm text-(--text-muted) mt-0.5">{formatBaht(entry.unitPrice)}.-</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(entry.key, entry.qty - 1)}
                      aria-label={`ลด ${entry.name}`}
                      className="w-11 h-11 rounded-full bg-(--surface-muted) font-bold leading-none"
                    >
                      −
                    </button>
                    <span className="w-4 text-center font-medium tabular-nums">{entry.qty}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(entry.key, entry.qty + 1)}
                      aria-label={`เพิ่ม ${entry.name}`}
                      className="w-11 h-11 rounded-full bg-(--brand) text-(--brand-foreground) font-bold leading-none"
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {entries.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2 border-t border-(--surface-border) font-semibold text-lg">
                <span>ยอดรวม</span>
                <span>{formatBaht(subtotal)}.-</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  idempotencyKeyRef.current = null;
                  setSnapshot({ count: liveCount, subtotal: liveSubtotal });
                  setStep("confirm");
                }}
                className="w-full bg-(--cta) text-white rounded-2xl py-4 font-semibold active:scale-[0.98] transition-transform"
              >
                ส่งออเดอร์
              </button>
            </>
          )}
        </div>
      )}

      {(step === "confirm" || step === "sending") && (
        <div className="pt-3 space-y-6 text-center">
          <h2 id="cart-sheet-title" className="page-heading text-[1.375rem]">
            พร้อมสั่งแล้วใช่ไหม?
          </h2>
          <div className="card bg-(--surface-muted) p-5 space-y-1.5">
            <p className="text-(--text-muted)">{tableName}</p>
            <p className="text-(--text-muted)">{count} รายการ</p>
            <p className="food-price text-2xl">รวม {formatBaht(subtotal)}.-</p>
          </div>
          {submitError && (
            <div className="p-3 rounded-xl bg-red-100 text-(--text-danger) text-sm text-left">
              ส่งออเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setSnapshot(null);
                setStep("cart");
              }}
              disabled={step === "sending"}
              className="flex-1 bg-(--surface-muted) text-(--foreground) rounded-2xl py-3.5 font-medium disabled:opacity-50"
            >
              กลับไปแก้ไข
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={step === "sending"}
              className="flex-1 bg-(--cta) text-white rounded-2xl py-3.5 font-semibold disabled:opacity-60"
            >
              {step === "sending" ? "กำลังส่ง..." : "ส่งออเดอร์"}
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="pt-3 pb-2 space-y-4 text-center">
          <CelebrationBurst className="w-24 h-24 mx-auto" />
          <div>
            <h2 id="cart-sheet-title" className="page-heading text-[1.375rem]">
              ส่งออเดอร์แล้ว!
            </h2>
            <p className="text-(--text-muted) mt-1">ร้านได้รับออเดอร์ของคุณแล้ว</p>
          </div>
          {orderId && (
            <p className="text-sm text-(--text-muted-2)">
              หมายเลขออเดอร์ #{orderId.slice(-4).toUpperCase()}
            </p>
          )}
          <div className="inline-flex items-center gap-2 chip">
            <span className="w-2 h-2 rounded-full bg-(--cta) animate-pulse" />
            กำลังเตรียมอาหาร
          </div>
          <button
            type="button"
            onClick={() => {
              handleClose();
              onViewStatus();
            }}
            className="w-full bg-(--brand) text-(--brand-foreground) rounded-2xl py-4 font-semibold mt-2"
          >
            ดูสถานะออเดอร์
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
