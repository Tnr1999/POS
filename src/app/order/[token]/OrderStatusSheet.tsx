"use client";

import type { ReactNode } from "react";
import { formatBaht } from "@/lib/money";
import { BottomSheet } from "./BottomSheet";
import { EmptyPlateDoodle, ReceivedIcon, PreparingPotIcon, ServingTrayIcon, ServedCheckIcon } from "./illustrations";
import { ORDER_STAGES, ORDER_STAGE_LABEL, currentOrderStage, stageIndex, type OrderStage } from "@/lib/orderProgress";
import type { OpenOrderState } from "./types";

const STAGE_ICON: Record<OrderStage, (props: { className?: string }) => ReactNode> = {
  received: ReceivedIcon,
  preparing: PreparingPotIcon,
  serving: ServingTrayIcon,
  served: ServedCheckIcon,
};

export function OrderStatusSheet({
  open,
  order,
  onClose,
}: {
  open: boolean;
  order: OpenOrderState;
  onClose: () => void;
}) {
  const stage = order ? currentOrderStage(order.items) : null;
  const activeIndex = stage ? stageIndex(stage) : -1;
  const total = order?.items.reduce((sum, i) => sum + i.price * i.qty, 0) ?? 0;

  return (
    <BottomSheet open={open} onClose={onClose} labelledBy="order-status-title">
      <div className="pt-3 space-y-5">
        <h2 id="order-status-title" className="page-heading text-[1.375rem]">
          สถานะออเดอร์
        </h2>

        {!order ? (
          <div className="text-center py-8 space-y-3">
            <EmptyPlateDoodle className="w-20 h-20 mx-auto" />
            <p className="text-(--text-muted-2)">ยังไม่มีออเดอร์ที่กำลังดำเนินการ</p>
          </div>
        ) : (
          <>
            <ol className="space-y-0">
              {ORDER_STAGES.map((s, i) => {
                const Icon = STAGE_ICON[s];
                const done = i <= activeIndex;
                const isLast = i === ORDER_STAGES.length - 1;
                return (
                  <li key={s} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          done ? "bg-(--brand) text-(--brand-foreground)" : "bg-(--surface-muted) text-(--text-muted-2)"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      {!isLast && (
                        <span
                          className={`w-0.5 flex-1 min-h-[1.75rem] ${done && i < activeIndex ? "bg-(--brand)" : "bg-(--surface-border)"}`}
                        />
                      )}
                    </div>
                    <div className="pb-6 pt-1.5">
                      <p className={`font-medium ${done ? "text-(--foreground)" : "text-(--text-muted-2)"}`}>
                        {ORDER_STAGE_LABEL[s]}
                      </p>
                      {i === activeIndex && (
                        <p className="text-xs text-(--cta) mt-0.5">กำลังดำเนินการอยู่ตอนนี้</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="border-t border-(--surface-border) pt-4 space-y-2">
              <h3 className="font-semibold text-sm text-(--text-muted)">รายการที่สั่ง</h3>
              <ul className="space-y-1.5 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span>
                      {item.name} <span className="text-(--text-muted)">x{item.qty}</span>
                    </span>
                    <span className="font-medium">{formatBaht(item.price * item.qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between pt-2 border-t border-(--surface-border) font-semibold">
                <span>รวม</span>
                <span>{formatBaht(total)}.-</span>
              </div>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
