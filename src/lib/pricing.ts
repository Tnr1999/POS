// Pure checkout/payment math — no Prisma or other I/O dependency, so every
// rule here is independently unit-testable and is the single source of
// truth for how a bill's final amount and change are derived. payOrder
// (src/app/(staff)/pos/actions.ts) is the only caller that may persist the
// results; nothing here trusts a client-supplied total.
//
// All money amounts are integer satang (1 THB = 100 satang), matching every
// other money field in the schema. All rates are integer basis points
// (1 bp = 0.01%, e.g. 700 = 7.00%) rather than a float percentage, so a rate
// can never suffer floating-point representation drift.

export const PAYMENT_METHODS = ["CASH", "QR_PAYMENT"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Runtime guard for untrusted input (e.g. a Server Action's raw argument) — never trust a client-supplied string is one of the allowed methods without this. */
export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export type DiscountInput =
  | { type: "PERCENT"; percentBasisPoints: number }
  | { type: "AMOUNT"; amountSatang: number };

export type PricingInput = {
  /** Sum of (OrderItem.price * qty) for the order's non-cancelled items, in satang. */
  subtotalAmount: number;
  discount?: DiscountInput;
  /** Basis points, e.g. 1000 = 10%. Omit or 0 for no service charge. */
  serviceChargeRateBasisPoints?: number;
  /** Basis points, e.g. 700 = 7%. Omit or 0 for no tax/VAT. */
  taxRateBasisPoints?: number;
};

export type PricingResult = {
  subtotalAmount: number;
  discountAmount: number;
  serviceChargeAmount: number;
  taxAmount: number;
  grandTotalAmount: number;
};

const BASIS_POINTS_DENOMINATOR = 10_000; // 1 bp = 1/10000 = 0.01%

/**
 * subtotal - discount + serviceCharge + tax = grandTotal
 *
 * Each derived amount is rounded exactly once, from the exact (unrounded)
 * upstream value, and never re-derived from a percentage a second time —
 * this is what keeps subtotal - discount + serviceCharge + tax always
 * exactly equal to grandTotal, to the satang, regardless of the rates used.
 */
export function computeOrderPricing(input: PricingInput): PricingResult {
  const subtotalAmount = Math.max(0, Math.trunc(input.subtotalAmount));

  let discountAmount = 0;
  if (input.discount) {
    const rawDiscount =
      input.discount.type === "PERCENT"
        ? (subtotalAmount * Math.max(0, input.discount.percentBasisPoints)) / BASIS_POINTS_DENOMINATOR
        : Math.max(0, input.discount.amountSatang);
    // A discount can never exceed the subtotal it applies to — this is what
    // keeps "discount greater than the total" safe: the grand total floors
    // at 0 instead of going negative.
    discountAmount = Math.min(Math.round(rawDiscount), subtotalAmount);
  }

  const afterDiscount = subtotalAmount - discountAmount;

  const serviceChargeRateBasisPoints = Math.max(0, input.serviceChargeRateBasisPoints ?? 0);
  const serviceChargeAmount = Math.round((afterDiscount * serviceChargeRateBasisPoints) / BASIS_POINTS_DENOMINATOR);

  const afterServiceCharge = afterDiscount + serviceChargeAmount;

  const taxRateBasisPoints = Math.max(0, input.taxRateBasisPoints ?? 0);
  const taxAmount = Math.round((afterServiceCharge * taxRateBasisPoints) / BASIS_POINTS_DENOMINATOR);

  const grandTotalAmount = afterServiceCharge + taxAmount;

  return { subtotalAmount, discountAmount, serviceChargeAmount, taxAmount, grandTotalAmount };
}

export type PaymentValidation = { ok: true; changeAmount: number } | { ok: false; error: string };

/**
 * Validates a tendered payment against the server-computed grand total and
 * derives the change owed. The caller must always pass a grandTotalAmount
 * computed by computeOrderPricing from DB data — never a client-supplied
 * total — this function only checks the tendered amount against it.
 */
export function validatePayment(params: {
  paymentMethod: PaymentMethod;
  grandTotalAmount: number;
  paidAmount: number;
}): PaymentValidation {
  const { paymentMethod, grandTotalAmount, paidAmount } = params;

  if (!Number.isInteger(paidAmount) || paidAmount < 0) {
    return { ok: false, error: "จำนวนเงินที่รับไม่ถูกต้อง" };
  }

  if (paymentMethod === "CASH") {
    if (paidAmount < grandTotalAmount) {
      return { ok: false, error: "จำนวนเงินที่รับน้อยกว่ายอดที่ต้องชำระ" };
    }
    return { ok: true, changeAmount: paidAmount - grandTotalAmount };
  }

  // QR_PAYMENT (and any other non-cash method added later): must match
  // exactly — there is no "tendered/change" concept outside of cash.
  if (paidAmount !== grandTotalAmount) {
    return { ok: false, error: "จำนวนเงินที่ชำระไม่ตรงกับยอดที่ต้องชำระ" };
  }
  return { ok: true, changeAmount: 0 };
}
