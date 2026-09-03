import { describe, expect, it } from "vitest";
import { resolveOrderTotals, type OrderForTotals } from "@/lib/orderTotals";

function baseOrder(overrides: Partial<OrderForTotals> = {}): OrderForTotals {
  return {
    items: [{ price: 6000, qty: 3, status: "PENDING" }], // 180.00 THB
    subtotalAmount: null,
    discountAmount: null,
    serviceChargeRate: null,
    serviceChargeAmount: null,
    taxRate: null,
    taxAmount: null,
    grandTotalAmount: null,
    paymentMethod: null,
    paidAmount: null,
    changeAmount: null,
    ...overrides,
  };
}

describe("resolveOrderTotals — snapshot orders", () => {
  it("uses grandTotalAmount as the source of truth, not a re-derived item sum", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      discountAmount: 0,
      serviceChargeRate: 0,
      serviceChargeAmount: 0,
      taxRate: 0,
      taxAmount: 0,
      grandTotalAmount: 18000,
      paymentMethod: "CASH",
      paidAmount: 20000,
      changeAmount: 2000,
      // Deliberately mismatched from the snapshot to prove it's ignored.
      items: [{ price: 999999, qty: 1, status: "PENDING" }],
    });
    const result = resolveOrderTotals(order);
    expect(result.source).toBe("snapshot");
    expect(result.grandTotalAmount).toBe(18000);
    expect(result.subtotalAmount).toBe(18000);
  });

  it("surfaces discountAmount from the snapshot", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      discountAmount: 2000,
      grandTotalAmount: 16000,
      paymentMethod: "CASH",
      paidAmount: 16000,
      changeAmount: 0,
    });
    const result = resolveOrderTotals(order);
    expect(result.discountAmount).toBe(2000);
    expect(result.grandTotalAmount).toBe(16000);
  });

  it("surfaces serviceChargeAmount together with the rate used at payment time", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      serviceChargeRate: 1000, // 10%
      serviceChargeAmount: 1800,
      grandTotalAmount: 19800,
      paymentMethod: "CASH",
      paidAmount: 19800,
      changeAmount: 0,
    });
    const result = resolveOrderTotals(order);
    expect(result.serviceChargeRate).toBe(1000);
    expect(result.serviceChargeAmount).toBe(1800);
  });

  it("surfaces taxAmount together with the rate used at payment time", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      taxRate: 700, // 7%
      taxAmount: 1260,
      grandTotalAmount: 19260,
      paymentMethod: "CASH",
      paidAmount: 19260,
      changeAmount: 0,
    });
    const result = resolveOrderTotals(order);
    expect(result.taxRate).toBe(700);
    expect(result.taxAmount).toBe(1260);
  });

  it("CASH: exposes paidAmount and changeAmount exactly as stored", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      grandTotalAmount: 18000,
      paymentMethod: "CASH",
      paidAmount: 20000,
      changeAmount: 2000,
    });
    const result = resolveOrderTotals(order);
    expect(result.paymentMethod).toBe("CASH");
    expect(result.paidAmount).toBe(20000);
    expect(result.changeAmount).toBe(2000);
  });

  it("QR_PAYMENT: paidAmount equals the grand total and changeAmount is zero, never invented", () => {
    const order = baseOrder({
      subtotalAmount: 18000,
      grandTotalAmount: 18000,
      paymentMethod: "QR_PAYMENT",
      paidAmount: 18000,
      changeAmount: 0,
    });
    const result = resolveOrderTotals(order);
    expect(result.paymentMethod).toBe("QR_PAYMENT");
    expect(result.paidAmount).toBe(18000);
    expect(result.changeAmount).toBe(0);
  });

  it("an unrecognized/corrupt paymentMethod value is treated as unknown, never passed through as fact", () => {
    const order = baseOrder({ grandTotalAmount: 18000, paymentMethod: "BITCOIN" });
    const result = resolveOrderTotals(order);
    expect(result.paymentMethod).toBeNull();
  });
});

describe("resolveOrderTotals — legacy orders (paid before the payment snapshot existed)", () => {
  it("falls back to summing OrderItem rows when grandTotalAmount is null", () => {
    const order = baseOrder({
      items: [
        { price: 6000, qty: 3, status: "PENDING" },
        { price: 4000, qty: 1, status: "SERVED" },
      ],
    });
    const result = resolveOrderTotals(order);
    expect(result.source).toBe("legacy");
    expect(result.subtotalAmount).toBe(6000 * 3 + 4000 * 1);
    expect(result.grandTotalAmount).toBe(result.subtotalAmount);
  });

  it("excludes CANCELLED items from the legacy sum", () => {
    const order = baseOrder({
      items: [
        { price: 6000, qty: 3, status: "PENDING" },
        { price: 4000, qty: 1, status: "CANCELLED" },
      ],
    });
    const result = resolveOrderTotals(order);
    expect(result.subtotalAmount).toBe(6000 * 3);
  });

  it("never invents a payment method, paid amount, or change for a legacy order", () => {
    const result = resolveOrderTotals(baseOrder());
    expect(result.paymentMethod).toBeNull();
    expect(result.paidAmount).toBeNull();
    expect(result.changeAmount).toBeNull();
  });

  it("never invents a discount, service charge, or tax for a legacy order", () => {
    const result = resolveOrderTotals(baseOrder());
    expect(result.discountAmount).toBe(0);
    expect(result.serviceChargeAmount).toBe(0);
    expect(result.serviceChargeRate).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });
});
