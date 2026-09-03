"use client";

import { useState } from "react";
import Image from "next/image";
import { formatBaht } from "@/lib/money";
import { UtensilsIcon } from "@/components/icons";
import { BottomSheet } from "./BottomSheet";
import { SPICE_LEVELS, ADD_ONS } from "@/lib/menuOptions";
import type { MenuItem } from "./types";

export function FoodDetailSheet({
  item,
  maxQty,
  onClose,
  onAddToCart,
}: {
  item: MenuItem;
  maxQty: number;
  onClose: () => void;
  onAddToCart: (input: {
    qty: number;
    unitPrice: number;
    spiceLevel?: string;
    addOnIds: string[];
    addOnNames: string[];
    note?: string;
  }) => void;
}) {
  const [spiceLevel, setSpiceLevel] = useState<string | undefined>(undefined);
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  const addOnsTotal = ADD_ONS.filter((a) => addOnIds.includes(a.id)).reduce((s, a) => s + a.price, 0);
  const unitPrice = item.price + addOnsTotal;
  const total = unitPrice * qty;

  function toggleAddOn(id: string) {
    setAddOnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleAdd() {
    const addOnNames = ADD_ONS.filter((a) => addOnIds.includes(a.id)).map((a) => a.name);
    onAddToCart({ qty, unitPrice, spiceLevel, addOnIds, addOnNames, note: note.trim() || undefined });
    onClose();
  }

  return (
    <BottomSheet open onClose={onClose} labelledBy="food-detail-name">
      <div className="relative -mx-5 -mt-1 aspect-[16/10] bg-(--surface-muted)">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill unoptimized className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-(--brand-soft)/40">
            <UtensilsIcon className="w-14 h-14" />
          </div>
        )}
      </div>

      <div className="pt-4 space-y-5">
        <div>
          <h2 id="food-detail-name" className="page-heading text-[1.375rem]">
            {item.name}
          </h2>
          {item.description && (
            <p className="text-(--text-muted) mt-1.5 leading-relaxed">{item.description}</p>
          )}
          <p className="food-price mt-2">{formatBaht(item.price)}.-</p>
        </div>

        {item.supportsCustomization && (
          <div>
            <h3 className="font-semibold mb-2">ระดับความเผ็ด</h3>
            <div className="flex flex-wrap gap-2">
              {SPICE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSpiceLevel(level)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-colors ${
                    spiceLevel === level
                      ? "bg-(--brand) text-(--brand-foreground) border-(--brand)"
                      : "bg-(--surface) border-(--surface-border) text-(--text-subtle)"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {item.supportsCustomization && (
          <div>
            <h3 className="font-semibold mb-2">เพิ่มเติม</h3>
            <div className="space-y-1">
              {ADD_ONS.map((addOn) => (
                <label
                  key={addOn.id}
                  className="flex items-center justify-between gap-3 py-2 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={addOnIds.includes(addOn.id)}
                      onChange={() => toggleAddOn(addOn.id)}
                      className="w-5 h-5 rounded accent-(--brand)"
                    />
                    <span className="text-(--foreground)">{addOn.name}</span>
                  </span>
                  <span className="text-(--text-muted) text-sm shrink-0">
                    +{formatBaht(addOn.price)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">หมายเหตุ</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="ไม่ใส่ผัก / แพ้อะไร / อื่น ๆ"
            className="w-full rounded-xl border border-(--surface-border) bg-(--surface) px-3.5 py-2.5 placeholder:text-(--text-muted-2) focus:outline-none focus:ring-2 focus:ring-(--brand) resize-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-semibold">จำนวน</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="ลดจำนวน"
              className="w-11 h-11 rounded-full bg-(--surface-muted) font-bold text-lg disabled:opacity-40"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold text-lg tabular-nums">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              disabled={qty >= maxQty}
              aria-label="เพิ่มจำนวน"
              className="w-11 h-11 rounded-full bg-(--brand) text-(--brand-foreground) font-bold text-lg disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="w-full bg-(--cta) text-white rounded-2xl py-4 font-semibold text-base flex items-center justify-center gap-2 shadow-[0_10px_24px_rgb(200_79_18_/_0.3)] active:scale-[0.98] transition-transform"
        >
          เพิ่มลงตะกร้า • {formatBaht(total)}.-
        </button>
      </div>
    </BottomSheet>
  );
}
