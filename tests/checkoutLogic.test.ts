import { describe, expect, it } from "vitest";
import {
  canSubmitPayment,
  evaluateCashInput,
  mapPayOrderError,
  resolvePaidAmount,
} from "@/app/(staff)/pos/checkoutLogic";

const GRAND_TOTAL = 18000; // 180.00 THB in satang

describe("evaluateCashInput", () => {
  it("empty input is treated as no input, not a valid zero payment", () => {
    const result = evaluateCashInput("", GRAND_TOTAL);
    expect(result).toEqual({ hasInput: false, paidAmountSatang: null, isUnderpaid: false, changeAmount: 0 });
  });

  it("whitespace-only input is treated as no input", () => {
    const result = evaluateCashInput("   ", GRAND_TOTAL);
    expect(result.hasInput).toBe(false);
  });

  it("non-numeric input is treated as no input", () => {
    const result = evaluateCashInput("abc", GRAND_TOTAL);
    expect(result.hasInput).toBe(false);
  });

  it("cash paid less than the grand total is flagged underpaid, with zero change", () => {
    const result = evaluateCashInput("150", GRAND_TOTAL); // 150.00 THB < 180.00 THB
    expect(result.hasInput).toBe(true);
    expect(result.isUnderpaid).toBe(true);
    expect(result.changeAmount).toBe(0);
  });

  it("cash paid exactly equal to the grand total is valid, with zero change", () => {
    const result = evaluateCashInput("180", GRAND_TOTAL);
    expect(result.hasInput).toBe(true);
    expect(result.isUnderpaid).toBe(false);
    expect(result.paidAmountSatang).toBe(GRAND_TOTAL);
    expect(result.changeAmount).toBe(0);
  });

  it("cash paid more than the grand total is valid, with the correct change", () => {
    const result = evaluateCashInput("200", GRAND_TOTAL); // 200.00 THB
    expect(result.hasInput).toBe(true);
    expect(result.isUnderpaid).toBe(false);
    expect(result.paidAmountSatang).toBe(20000);
    expect(result.changeAmount).toBe(2000); // 20.00 THB
  });

  it("a negative amount is treated as no input", () => {
    const result = evaluateCashInput("-50", GRAND_TOTAL);
    expect(result.hasInput).toBe(false);
  });
});

describe("resolvePaidAmount / canSubmitPayment", () => {
  it("QR_PAYMENT always resolves to the grand total, regardless of any cash input left over", () => {
    expect(resolvePaidAmount("QR_PAYMENT", "", GRAND_TOTAL)).toBe(GRAND_TOTAL);
    expect(resolvePaidAmount("QR_PAYMENT", "999", GRAND_TOTAL)).toBe(GRAND_TOTAL);
    expect(canSubmitPayment("QR_PAYMENT", "", GRAND_TOTAL)).toBe(true);
  });

  it("CASH with no input cannot be submitted", () => {
    expect(resolvePaidAmount("CASH", "", GRAND_TOTAL)).toBeNull();
    expect(canSubmitPayment("CASH", "", GRAND_TOTAL)).toBe(false);
  });

  it("CASH with insufficient input cannot be submitted", () => {
    expect(resolvePaidAmount("CASH", "100", GRAND_TOTAL)).toBeNull();
    expect(canSubmitPayment("CASH", "100", GRAND_TOTAL)).toBe(false);
  });

  it("CASH with sufficient input resolves to the typed satang amount and can be submitted", () => {
    expect(resolvePaidAmount("CASH", "180", GRAND_TOTAL)).toBe(GRAND_TOTAL);
    expect(canSubmitPayment("CASH", "180", GRAND_TOTAL)).toBe(true);
    expect(resolvePaidAmount("CASH", "200", GRAND_TOTAL)).toBe(20000);
  });

  it("switching from QR_PAYMENT to CASH with no cash typed yet becomes non-submittable", () => {
    expect(canSubmitPayment("QR_PAYMENT", "", GRAND_TOTAL)).toBe(true);
    expect(canSubmitPayment("CASH", "", GRAND_TOTAL)).toBe(false);
  });

  it("switching from CASH (insufficient) to QR_PAYMENT becomes submittable again", () => {
    expect(canSubmitPayment("CASH", "50", GRAND_TOTAL)).toBe(false);
    expect(canSubmitPayment("QR_PAYMENT", "50", GRAND_TOTAL)).toBe(true);
  });

  it("a zero grand total (e.g. fully discounted) is submittable for both methods with zero paid", () => {
    expect(canSubmitPayment("QR_PAYMENT", "", 0)).toBe(true);
    expect(canSubmitPayment("CASH", "0", 0)).toBe(true);
  });
});

describe("mapPayOrderError", () => {
  it("maps the CANCELLED-order rejection to friendly copy", () => {
    expect(mapPayOrderError(new Error("ออเดอร์นี้ไม่สามารถชำระเงินได้ในสถานะปัจจุบัน"))).toBe(
      "ออเดอร์นี้ถูกยกเลิกแล้ว"
    );
  });

  it("maps CASH underpayment rejection to friendly copy", () => {
    expect(mapPayOrderError(new Error("จำนวนเงินที่รับน้อยกว่ายอดที่ต้องชำระ"))).toBe(
      "จำนวนเงินที่รับมายังไม่เพียงพอ"
    );
  });

  it("maps QR_PAYMENT amount-mismatch rejection to friendly copy", () => {
    expect(mapPayOrderError(new Error("จำนวนเงินที่ชำระไม่ตรงกับยอดที่ต้องชำระ"))).toBe(
      "ยอดที่ต้องชำระมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง"
    );
  });

  it("falls back to a generic retry message for an unrecognized Error", () => {
    expect(mapPayOrderError(new Error("ไม่พบออเดอร์นี้"))).toBe("ไม่สามารถชำระเงินได้ กรุณาลองใหม่");
  });

  it("falls back to a generic retry message for a non-Error/network failure, never swallowing it", () => {
    expect(mapPayOrderError("some network failure")).toBe("ไม่สามารถชำระเงินได้ กรุณาลองใหม่");
    expect(mapPayOrderError(undefined)).toBe("ไม่สามารถชำระเงินได้ กรุณาลองใหม่");
  });
});
