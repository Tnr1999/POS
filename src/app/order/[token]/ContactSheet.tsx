"use client";

import { DishMarkIcon } from "@/components/icons";
import { BottomSheet } from "./BottomSheet";

export function ContactSheet({
  open,
  tableName,
  onClose,
}: {
  open: boolean;
  tableName: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} labelledBy="contact-sheet-title">
      <div className="pt-3 pb-2 space-y-5 text-center">
        <span className="w-14 h-14 rounded-2xl bg-(--brand) text-(--brand-foreground) flex items-center justify-center mx-auto">
          <DishMarkIcon className="w-7 h-7" />
        </span>
        <div>
          <h2 id="contact-sheet-title" className="page-heading text-[1.375rem]">
            บ้านอร่อย
          </h2>
          <p className="text-(--text-muted) mt-1">คุณกำลังนั่งอยู่ที่ {tableName}</p>
        </div>
        <p className="text-(--text-muted) leading-relaxed">
          หากต้องการความช่วยเหลือ สอบถามเมนู หรือแจ้งปัญหาใด ๆ
          กรุณาเรียกพนักงานที่โต๊ะของคุณได้โดยตรง ทางร้านยินดีให้บริการค่ะ
        </p>
      </div>
    </BottomSheet>
  );
}
