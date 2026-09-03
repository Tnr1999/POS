// Pure checkout-UI helper logic — no React/DOM dependency, so it's
// independently unit-testable without a rendering library. CheckoutModal.tsx
// is a thin wrapper around these functions plus the actual payOrder() call;
// the money math itself is never duplicated here — it all comes from
// src/lib/pricing.ts, which this module treats as the single source of
// truth for what a "grand total" is.

import { toSatang } from "@/lib/money";
import type { PaymentMethod } from "@/lib/pricing";

export type CashEvaluation = {
  hasInput: boolean;
  paidAmountSatang: number | null;
  isUnderpaid: boolean;
  changeAmount: number;
};

/**
 * Evaluates the cashier's typed "cash received" baht string against the
 * server-computed grand total (satang). An empty/invalid/negative input is
 * treated as "no input yet" (not zero), matching the requirement that
 * submitting with nothing typed is invalid rather than a valid zero payment.
 */
export function evaluateCashInput(cashBahtInput: string, grandTotalAmount: number): CashEvaluation {
  const cashBaht = Number(cashBahtInput);
  const hasInput = cashBahtInput.trim() !== "" && Number.isFinite(cashBaht) && cashBaht >= 0;
  if (!hasInput) {
    return { hasInput: false, paidAmountSatang: null, isUnderpaid: false, changeAmount: 0 };
  }
  const paidAmountSatang = toSatang(cashBaht);
  const isUnderpaid = paidAmountSatang < grandTotalAmount;
  return {
    hasInput: true,
    paidAmountSatang,
    isUnderpaid,
    changeAmount: isUnderpaid ? 0 : paidAmountSatang - grandTotalAmount,
  };
}

/**
 * The satang amount that would actually be submitted to payOrder for the
 * given method/input, or null if checkout isn't in a submittable state yet
 * (CASH with no/insufficient input). QR_PAYMENT always resolves to the
 * server-computed grand total — the cashier can never edit it.
 */
export function resolvePaidAmount(
  paymentMethod: PaymentMethod,
  cashBahtInput: string,
  grandTotalAmount: number
): number | null {
  if (paymentMethod === "QR_PAYMENT") return grandTotalAmount;
  const cash = evaluateCashInput(cashBahtInput, grandTotalAmount);
  return cash.hasInput && !cash.isUnderpaid ? cash.paidAmountSatang : null;
}

export function canSubmitPayment(
  paymentMethod: PaymentMethod,
  cashBahtInput: string,
  grandTotalAmount: number
): boolean {
  return resolvePaidAmount(paymentMethod, cashBahtInput, grandTotalAmount) !== null;
}

/**
 * Maps a thrown payOrder() error to cashier-facing Thai copy. payOrder's own
 * error messages are already correct Thai text; a few are reworded here to
 * match the product's requested wording. Anything unrecognized (including a
 * non-Error/network failure) falls back to a generic retry message — this
 * function always returns a string, so an error is never swallowed silently.
 */
export function mapPayOrderError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message === "ออเดอร์นี้ไม่สามารถชำระเงินได้ในสถานะปัจจุบัน") {
    return "ออเดอร์นี้ถูกยกเลิกแล้ว";
  }
  if (message === "จำนวนเงินที่รับน้อยกว่ายอดที่ต้องชำระ") {
    return "จำนวนเงินที่รับมายังไม่เพียงพอ";
  }
  if (message === "จำนวนเงินที่ชำระไม่ตรงกับยอดที่ต้องชำระ") {
    return "ยอดที่ต้องชำระมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง";
  }
  return "ไม่สามารถชำระเงินได้ กรุณาลองใหม่";
}
