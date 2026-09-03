import { describe, expect, it } from "vitest";
import { computeOrderPricing, isPaymentMethod, validatePayment } from "@/lib/pricing";

describe("computeOrderPricing", () => {
  it("no discount/service/tax: grand total equals subtotal", () => {
    const result = computeOrderPricing({ subtotalAmount: 1000 });
    expect(result).toEqual({
      subtotalAmount: 1000,
      discountAmount: 0,
      serviceChargeAmount: 0,
      taxAmount: 0,
      grandTotalAmount: 1000,
    });
  });

  it("percent discount", () => {
    const result = computeOrderPricing({
      subtotalAmount: 1000,
      discount: { type: "PERCENT", percentBasisPoints: 1000 }, // 10%
    });
    expect(result.discountAmount).toBe(100);
    expect(result.grandTotalAmount).toBe(900);
  });

  it("flat amount discount", () => {
    const result = computeOrderPricing({
      subtotalAmount: 1000,
      discount: { type: "AMOUNT", amountSatang: 150 },
    });
    expect(result.discountAmount).toBe(150);
    expect(result.grandTotalAmount).toBe(850);
  });

  it("service charge only, applied to the post-discount base", () => {
    const result = computeOrderPricing({
      subtotalAmount: 1000,
      discount: { type: "AMOUNT", amountSatang: 200 },
      serviceChargeRateBasisPoints: 1000, // 10%
    });
    // (1000 - 200) * 10% = 80
    expect(result.serviceChargeAmount).toBe(80);
    expect(result.grandTotalAmount).toBe(1000 - 200 + 80);
  });

  it("VAT only, applied after discount and service charge", () => {
    const result = computeOrderPricing({
      subtotalAmount: 1000,
      serviceChargeRateBasisPoints: 1000, // 10% -> 100
      taxRateBasisPoints: 700, // 7% of (1000 + 100) = 77
    });
    expect(result.serviceChargeAmount).toBe(100);
    expect(result.taxAmount).toBe(77);
    expect(result.grandTotalAmount).toBe(1000 + 100 + 77);
  });

  it("combination of discount + service charge + tax, chained in the documented order", () => {
    const result = computeOrderPricing({
      subtotalAmount: 2000,
      discount: { type: "PERCENT", percentBasisPoints: 500 }, // 5% -> 100
      serviceChargeRateBasisPoints: 1000, // 10%
      taxRateBasisPoints: 700, // 7%
    });
    const afterDiscount = 2000 - 100; // 1900
    const serviceCharge = Math.round(afterDiscount * 0.1); // 190
    const afterService = afterDiscount + serviceCharge; // 2090
    const tax = Math.round(afterService * 0.07); // 146.3 -> 146
    expect(result.discountAmount).toBe(100);
    expect(result.serviceChargeAmount).toBe(serviceCharge);
    expect(result.taxAmount).toBe(tax);
    expect(result.grandTotalAmount).toBe(afterService + tax);
    // Internal consistency: the formula must always net out exactly.
    expect(result.subtotalAmount - result.discountAmount + result.serviceChargeAmount + result.taxAmount).toBe(
      result.grandTotalAmount
    );
  });

  it("rounding: each derived amount is rounded exactly once from an exact intermediate value", () => {
    // 25.5% of 100 = 25.5 exactly -> rounds to 26 (round-half-up).
    const result = computeOrderPricing({
      subtotalAmount: 100,
      discount: { type: "PERCENT", percentBasisPoints: 2550 },
    });
    expect(result.discountAmount).toBe(26);
    expect(result.grandTotalAmount).toBe(74);
  });

  it("discount greater than the subtotal is clamped, never producing a negative total", () => {
    const result = computeOrderPricing({
      subtotalAmount: 500,
      discount: { type: "AMOUNT", amountSatang: 999999 },
    });
    expect(result.discountAmount).toBe(500);
    expect(result.grandTotalAmount).toBe(0);
  });

  it("a discount percent over 100% is also clamped to the subtotal", () => {
    const result = computeOrderPricing({
      subtotalAmount: 500,
      discount: { type: "PERCENT", percentBasisPoints: 20000 }, // 200%
    });
    expect(result.discountAmount).toBe(500);
    expect(result.grandTotalAmount).toBe(0);
  });

  it("zero values: zero subtotal with all rates/discount produces an all-zero breakdown", () => {
    const result = computeOrderPricing({
      subtotalAmount: 0,
      discount: { type: "PERCENT", percentBasisPoints: 1000 },
      serviceChargeRateBasisPoints: 1000,
      taxRateBasisPoints: 700,
    });
    expect(result).toEqual({
      subtotalAmount: 0,
      discountAmount: 0,
      serviceChargeAmount: 0,
      taxAmount: 0,
      grandTotalAmount: 0,
    });
  });
});

describe("validatePayment", () => {
  it("CASH: paid amount below the grand total is rejected", () => {
    const result = validatePayment({ paymentMethod: "CASH", grandTotalAmount: 1000, paidAmount: 900 });
    expect(result.ok).toBe(false);
  });

  it("CASH: paid amount at or above the grand total is accepted, with correct change", () => {
    const exact = validatePayment({ paymentMethod: "CASH", grandTotalAmount: 1000, paidAmount: 1000 });
    expect(exact).toEqual({ ok: true, changeAmount: 0 });

    const overpaid = validatePayment({ paymentMethod: "CASH", grandTotalAmount: 1000, paidAmount: 1500 });
    expect(overpaid).toEqual({ ok: true, changeAmount: 500 });
  });

  it("QR_PAYMENT: paid amount must match the grand total exactly", () => {
    const under = validatePayment({ paymentMethod: "QR_PAYMENT", grandTotalAmount: 1000, paidAmount: 999 });
    expect(under.ok).toBe(false);

    const over = validatePayment({ paymentMethod: "QR_PAYMENT", grandTotalAmount: 1000, paidAmount: 1001 });
    expect(over.ok).toBe(false);

    const exact = validatePayment({ paymentMethod: "QR_PAYMENT", grandTotalAmount: 1000, paidAmount: 1000 });
    expect(exact).toEqual({ ok: true, changeAmount: 0 });
  });

  it("zero values: a zero grand total is payable with zero, for either method", () => {
    expect(validatePayment({ paymentMethod: "CASH", grandTotalAmount: 0, paidAmount: 0 })).toEqual({
      ok: true,
      changeAmount: 0,
    });
    expect(validatePayment({ paymentMethod: "QR_PAYMENT", grandTotalAmount: 0, paidAmount: 0 })).toEqual({
      ok: true,
      changeAmount: 0,
    });
  });
});

describe("isPaymentMethod", () => {
  it("accepts only the documented allowed set", () => {
    expect(isPaymentMethod("CASH")).toBe(true);
    expect(isPaymentMethod("QR_PAYMENT")).toBe(true);
    expect(isPaymentMethod("CARD")).toBe(false);
    expect(isPaymentMethod("cash")).toBe(false);
    expect(isPaymentMethod("")).toBe(false);
    expect(isPaymentMethod(null)).toBe(false);
    expect(isPaymentMethod(undefined)).toBe(false);
    expect(isPaymentMethod(123)).toBe(false);
  });
});
