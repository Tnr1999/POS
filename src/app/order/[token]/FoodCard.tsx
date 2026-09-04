"use client";

import { useState } from "react";
import Image from "next/image";
import { formatBaht } from "@/lib/money";
import { UtensilsIcon } from "@/components/icons";
import type { MenuItem } from "./types";

export function FoodCard({
  item,
  soldOut,
  plainQty,
  onOpenDetail,
  onQuickAdd,
  onQuickRemove,
}: {
  item: MenuItem;
  soldOut: boolean;
  plainQty: number;
  onOpenDetail: () => void;
  onQuickAdd: () => void;
  onQuickRemove: () => void;
}) {
  const [justAdded, setJustAdded] = useState(false);

  function handleQuickAdd(e: React.MouseEvent) {
    e.stopPropagation();
    onQuickAdd();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 180);
  }

  return (
    <div
      className={`card overflow-hidden flex flex-col transition-transform ${soldOut ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        className="text-left flex flex-col w-full"
        aria-label={`ดูรายละเอียด ${item.name}`}
      >
        <div className="relative aspect-[4/3] bg-(--surface-muted)">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, 280px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-(--brand-soft)/40">
              <UtensilsIcon className="w-10 h-10" />
            </div>
          )}
          {item.isFeatured && (
            <span className="absolute top-2 left-2 chip chip-gold">ขายดี</span>
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-[#2D2925]/50 flex items-center justify-center">
              <span className="text-white font-semibold text-sm">สินค้าหมด</span>
            </div>
          )}
        </div>
        <div className="p-3 pb-1.5 flex-1 flex flex-col gap-1">
          <p className="food-name line-clamp-1">{item.name}</p>
          {item.description && (
            <p className="text-sm text-(--text-muted) line-clamp-2 leading-snug">{item.description}</p>
          )}
        </div>
      </button>

      <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2">
        <span className="food-price">{formatBaht(item.price)}.-</span>
        {soldOut ? null : plainQty === 0 ? (
          <button
            type="button"
            onClick={handleQuickAdd}
            aria-label={`เพิ่ม ${item.name}`}
            className={`w-11 h-11 rounded-full bg-(--cta) text-white flex items-center justify-center text-xl font-bold leading-none shrink-0 transition-transform ${
              justAdded ? "scale-90" : "scale-100"
            }`}
          >
            +
          </button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickRemove();
              }}
              aria-label={`ลด ${item.name}`}
              className="w-11 h-11 rounded-full bg-(--surface-muted) flex items-center justify-center font-bold leading-none shrink-0"
            >
              −
            </button>
            <span className="w-4 text-center text-sm font-semibold tabular-nums shrink-0">{plainQty}</span>
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={`เพิ่ม ${item.name}`}
              className={`w-11 h-11 rounded-full bg-(--cta) text-white flex items-center justify-center font-bold leading-none shrink-0 transition-transform ${
                justAdded ? "scale-90" : "scale-100"
              }`}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
