// Resolves the amounts to display/count for an Order, preferring the frozen
// checkout snapshot written by payOrder (Phase 2A) whenever one exists, and
// falling back to the pre-Phase-2A calculation (summing OrderItem rows) for
// orders paid before the snapshot existed. Pure — no Prisma dependency, so
// Receipt and Reports can both call it with whatever shape they already
// fetched, and it's independently unit-testable.
//
// Never backfills or invents payment data for a legacy order: paymentMethod/
// paidAmount/changeAmount stay null there, and every rate/amount besides the
// item-derived subtotal is 0, meaning "unknown/not applicable" — never a
// guessed real value.

import { isPaymentMethod, type PaymentMethod } from "./pricing";

export type OrderItemForTotals = { price: number; qty: number; status: string };

export type OrderForTotals = {
  items: OrderItemForTotals[];
  subtotalAmount: number | null;
  discountAmount: number | null;
  serviceChargeRate: number | null;
  serviceChargeAmount: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  grandTotalAmount: number | null;
  paymentMethod: string | null;
  paidAmount: number | null;
  changeAmount: number | null;
};

export type ResolvedOrderTotals = {
  /** "snapshot" = frozen at payment time by payOrder; "legacy" = paid before that snapshot existed, recomputed from OrderItem rows. */
  source: "snapshot" | "legacy";
  subtotalAmount: number;
  discountAmount: number;
  /** Basis points (1 bp = 0.01%). Always 0 for legacy orders — "unknown", not "definitely none". */
  serviceChargeRate: number;
  serviceChargeAmount: number;
  /** Basis points (1 bp = 0.01%). Always 0 for legacy orders — "unknown", not "definitely none". */
  taxRate: number;
  taxAmount: number;
  grandTotalAmount: number;
  paymentMethod: PaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
};

export function resolveOrderTotals(order: OrderForTotals): ResolvedOrderTotals {
  if (order.grandTotalAmount != null) {
    return {
      source: "snapshot",
      subtotalAmount: order.subtotalAmount ?? 0,
      discountAmount: order.discountAmount ?? 0,
      serviceChargeRate: order.serviceChargeRate ?? 0,
      serviceChargeAmount: order.serviceChargeAmount ?? 0,
      taxRate: order.taxRate ?? 0,
      taxAmount: order.taxAmount ?? 0,
      grandTotalAmount: order.grandTotalAmount,
      paymentMethod: isPaymentMethod(order.paymentMethod) ? order.paymentMethod : null,
      paidAmount: order.paidAmount,
      changeAmount: order.changeAmount,
    };
  }

  const subtotalAmount = order.items
    .filter((item) => item.status !== "CANCELLED")
    .reduce((sum, item) => sum + item.price * item.qty, 0);

  return {
    source: "legacy",
    subtotalAmount,
    discountAmount: 0,
    serviceChargeRate: 0,
    serviceChargeAmount: 0,
    taxRate: 0,
    taxAmount: 0,
    grandTotalAmount: subtotalAmount,
    paymentMethod: null,
    paidAmount: null,
    changeAmount: null,
  };
}
