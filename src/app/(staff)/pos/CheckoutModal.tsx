"use client";

import { useState } from "react";
import { formatBaht } from "@/lib/money";
import { computeOrderPricing, PAYMENT_METHODS, type PaymentMethod } from "@/lib/pricing";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { canSubmitPayment, evaluateCashInput, mapPayOrderError, resolvePaidAmount } from "./checkoutLogic";
import type { PayOrderOptions } from "./actions";

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  QR_PAYMENT: "QR พร้อมเพย์",
};

export type CheckoutOrder = {
  id: string;
  tableName: string | null;
  type: string;
  items: { id: string; name: string; price: number; qty: number; status: string }[];
};

/**
 * Checkout UI only: the amounts shown here (including the live change
 * preview) are for the cashier's convenience while typing. The actual
 * charge, validation, and change are always decided by payOrder() from the
 * order's real DB state — if the order changed since this modal opened
 * (e.g. another device added an item or paid first), the server call below
 * is what catches it, not anything computed here.
 */
export function CheckoutModal({
  open,
  order,
  payOrder,
  onClose,
  onPaid,
}: {
  open: boolean;
  order: CheckoutOrder | null;
  payOrder: (orderId: string, options?: PayOrderOptions) => Promise<void>;
  onClose: () => void;
  onPaid: (orderId: string) => void;
}) {
  // Parent remounts this component (via a `key` keyed on the order id) each
  // time a different order is opened for checkout, so plain useState here
  // is already a fresh slate per order — no reset effect needed.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [cashBahtInput, setCashBahtInput] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  if (!order) {
    // The order left the active list while this modal was open - most
    // likely another device already paid or cancelled it. Nothing to show
    // or charge; just let the cashier acknowledge and move on.
    return (
      <Modal open={open} onClose={onClose} title="ชำระเงิน" size="sm">
        <p className="text-sm text-(--text-muted)">
          ออเดอร์นี้ไม่สามารถชำระเงินได้แล้ว อาจถูกชำระเงินหรือยกเลิกไปแล้วจากอุปกรณ์อื่น
        </p>
        <Button variant="primary" fullWidth onClick={onClose}>
          ปิด
        </Button>
      </Modal>
    );
  }

  const liveItems = order.items.filter((i) => i.status !== "CANCELLED");
  const subtotalAmount = liveItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  // Preview only (no discount/service charge/tax config exists yet — every
  // rate defaults to 0, exactly like payOrder's own server-side defaults).
  // Reusing computeOrderPricing here instead of re-adding this math keeps
  // the formula defined in exactly one place.
  const pricing = computeOrderPricing({ subtotalAmount });

  const cash = evaluateCashInput(cashBahtInput, pricing.grandTotalAmount);
  const canSubmit = !isPaying && canSubmitPayment(paymentMethod, cashBahtInput, pricing.grandTotalAmount);

  async function handleConfirm() {
    const paidAmount = resolvePaidAmount(paymentMethod, cashBahtInput, pricing.grandTotalAmount);
    if (isPaying || paidAmount === null) return;
    setIsPaying(true);
    setError(null);
    try {
      await payOrder(order!.id, { paymentMethod, paidAmount });
      onPaid(order!.id);
    } catch (err) {
      setError(mapPayOrderError(err));
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <Modal open={open} onClose={isPaying ? () => {} : onClose} title="ชำระเงิน" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-(--text-muted) mb-2">
            {order.tableName ?? (order.type === "TAKEAWAY" ? "กลับบ้าน" : "หน้าร้าน")}
          </p>
          <ul className="text-sm space-y-1 mb-3">
            {liveItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {item.name} x{item.qty}
                </span>
                <span className="shrink-0 tabular-nums">{formatBaht(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 text-sm border-t border-(--surface-border) pt-2">
            <Row label="ยอดรวม" value={pricing.subtotalAmount} />
            <Row label="ส่วนลด" value={pricing.discountAmount === 0 ? 0 : -pricing.discountAmount} />
            <Row label="Service charge" value={pricing.serviceChargeAmount} />
            <Row label="VAT" value={pricing.taxAmount} />
          </div>
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-(--surface-border) font-bold text-lg">
            <span>ยอดที่ต้องชำระ</span>
            <span className="tabular-nums">{formatBaht(pricing.grandTotalAmount)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((method) => (
            <Button
              key={method}
              type="button"
              variant={paymentMethod === method ? "primary" : "ghost"}
              disabled={isPaying}
              onClick={() => setPaymentMethod(method)}
              aria-pressed={paymentMethod === method}
              fullWidth
            >
              {PAYMENT_METHOD_LABEL[method]}
            </Button>
          ))}
        </div>

        {paymentMethod === "CASH" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium block" htmlFor="checkout-cash-received">
              รับเงินจากลูกค้า (บาท)
            </label>
            <Input
              id="checkout-cash-received"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              disabled={isPaying}
              value={cashBahtInput}
              onChange={(e) => setCashBahtInput(e.target.value)}
              className="text-2xl font-semibold text-right py-3 tabular-nums"
              placeholder="0"
            />
            <div className="flex items-center justify-between text-sm text-(--text-muted)">
              <span>ยอดที่ต้องชำระ</span>
              <span className="tabular-nums">{formatBaht(pricing.grandTotalAmount)}</span>
            </div>
            {cash.isUnderpaid ? (
              <p className="text-sm text-(--text-danger)">จำนวนเงินที่รับมายังไม่เพียงพอ</p>
            ) : (
              <div className="flex items-center justify-between font-semibold">
                <span>เงินทอน</span>
                <span className="tabular-nums">{formatBaht(cash.changeAmount)}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-1 py-2">
            <p className="text-sm text-(--text-muted)">ยอดที่ต้องชำระ</p>
            <p className="text-3xl font-bold tabular-nums">฿{formatBaht(pricing.grandTotalAmount)}</p>
          </div>
        )}

        {error && <div className="p-3 rounded-xl bg-red-100 text-(--text-danger) text-sm">{error}</div>}

        <Button variant="cta" fullWidth disabled={!canSubmit} onClick={handleConfirm} className="py-3.5 text-base">
          {isPaying ? "กำลังชำระเงิน..." : paymentMethod === "CASH" ? "ชำระเงิน" : "ยืนยันการชำระเงิน"}
        </Button>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-(--text-muted)">
      <span>{label}</span>
      <span className="tabular-nums">{formatBaht(value)}</span>
    </div>
  );
}
