"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatBaht } from "@/lib/money";
import { DishMarkIcon, BellIcon, SearchIcon } from "@/components/icons";
import { FoodCard } from "./FoodCard";
import { FoodDetailSheet } from "./FoodDetailSheet";
import { CartFlowSheet } from "./CartFlowSheet";
import { OrderStatusSheet } from "./OrderStatusSheet";
import { ContactSheet } from "./ContactSheet";
import { CustomerBottomNav, type CustomerTab } from "./CustomerBottomNav";
import {
  SteamingBowlIllustration,
  EmptyPlateDoodle,
  NoResultsDoodle,
  RiceCategoryIcon,
  NoodleCategoryIcon,
  DrinkCategoryIcon,
  DessertCategoryIcon,
  SnackCategoryIcon,
} from "./illustrations";
import { currentOrderStage } from "@/lib/orderProgress";
import type { CartLine } from "./actions";
import type { CartEntry, MenuGroup, MenuItem, OpenOrderState } from "./types";

const ALL_GROUP_ID = "__all__";

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  if (name.includes("เครื่องดื่ม")) return <DrinkCategoryIcon className={className} />;
  if (name.includes("ของหวาน")) return <DessertCategoryIcon className={className} />;
  if (name.includes("เส้น")) return <NoodleCategoryIcon className={className} />;
  if (name.includes("ทานเล่น")) return <SnackCategoryIcon className={className} />;
  return <RiceCategoryIcon className={className} />;
}

function cartKey(menuItemId: string, spiceLevel?: string, addOnIds: string[] = [], note?: string): string {
  return [menuItemId, spiceLevel ?? "", [...addOnIds].sort().join(","), note ?? ""].join("|");
}

export function OrderClient({
  token,
  tableName,
  menuGroups,
  initialOrder,
  placeOrder,
}: {
  token: string;
  tableName: string;
  menuGroups: MenuGroup[];
  initialOrder: OpenOrderState;
  placeOrder: (
    token: string,
    cart: CartLine[],
    idempotencyKey?: string
  ) => Promise<{ unavailable: string[]; orderId: string | null }>;
}) {
  const [cartEntries, setCartEntries] = useState<CartEntry[]>([]);
  const [order, setOrder] = useState<OpenOrderState>(initialOrder);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({});
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(ALL_GROUP_ID);
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Guards against out-of-order responses between the two independent call
  // sites that both hit `/api/public/tables/${token}` — the 5s interval
  // poll below and refreshOrderNow() (fired right after a successful
  // submit). Without this, an earlier-dispatched request's response can
  // arrive after a later one's and overwrite fresher state with stale data
  // (e.g. a slow poll tick landing right after a submission would revert
  // the just-placed order back to "no order"). Both call sites share this
  // one ref — incremented immediately before each dispatches its fetch —
  // so whichever response comes back is only applied if it's still the
  // most recently dispatched one by the time it arrives.
  const pollSeqRef = useRef(0);

  const allItems = useMemo(() => menuGroups.flatMap((g) => g.items), [menuGroups]);
  const featuredItems = useMemo(() => allItems.filter((i) => i.isFeatured), [allItems]);

  // Poll for order status + live stock every 5s — unchanged from the
  // original implementation, just relocated into the redesigned component.
  useEffect(() => {
    async function refresh() {
      const seq = ++pollSeqRef.current;
      try {
        const res = await fetch(`/api/public/tables/${token}`, { cache: "no-store" });
        if (seq !== pollSeqRef.current) return; // superseded by a later request — discard
        if (!res.ok) return;
        const data = await res.json();
        if (seq !== pollSeqRef.current) return; // superseded while awaiting res.json()
        setOrder(data.order);
        if (data.stock) setStockLevels(data.stock);
      } catch {
        // ignore transient network errors while polling
      }
    }
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [token]);

  /** Fetch the latest order state right away — used right after a
   *  successful submit so "ดูสถานะออเดอร์" doesn't show stale/empty status
   *  while waiting for the next 5s poll tick. */
  async function refreshOrderNow() {
    const seq = ++pollSeqRef.current;
    try {
      const res = await fetch(`/api/public/tables/${token}`, { cache: "no-store" });
      if (seq !== pollSeqRef.current) return; // superseded by a later request — discard
      if (!res.ok) return;
      const data = await res.json();
      if (seq !== pollSeqRef.current) return; // superseded while awaiting res.json()
      setOrder(data.order);
      if (data.stock) setStockLevels(data.stock);
    } catch {
      // ignore — the regular poll will pick it up shortly
    }
  }

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(trimmedQuery) ||
        item.description?.toLowerCase().includes(trimmedQuery)
    );
  }, [allItems, isSearching, trimmedQuery]);

  // Scroll-spy for the sticky category chips — client-side only, no
  // per-click server request. Same proven approach as the previous version
  // of this page (and the staff order builder): plain scroll-position math
  // reads more predictably than IntersectionObserver for short sections.
  useEffect(() => {
    if (isSearching) return;
    const HEADER_OFFSET = 168;
    let ticking = false;

    function updateActiveGroup() {
      ticking = false;

      // If the page can't scroll any further, the last section's heading
      // may never actually cross HEADER_OFFSET when that section is short
      // (nothing left below it to push it up) — treat "at the bottom" as
      // "last category is active" rather than falling back to none/oldest.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom && menuGroups.length > 0) {
        setActiveGroupId(menuGroups[menuGroups.length - 1].id);
        return;
      }

      let current = ALL_GROUP_ID;
      for (const group of menuGroups) {
        const el = sectionRefs.current[group.id];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= HEADER_OFFSET + 1) current = group.id;
      }
      setActiveGroupId(current);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateActiveGroup);
    }

    updateActiveGroup();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuGroups, isSearching]);

  useEffect(() => {
    tabRefs.current[activeGroupId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeGroupId]);

  function scrollToGroup(id: string) {
    setActiveGroupId(id);
    if (id === ALL_GROUP_ID) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = sectionRefs.current[id];
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 116;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function stockOf(item: MenuItem): number {
    return stockLevels[item.id] ?? item.stock;
  }
  function isSoldOut(item: MenuItem): boolean {
    return item.trackStock && stockOf(item) <= 0;
  }
  function maxQtyOf(item: MenuItem): number {
    return item.trackStock ? Math.max(0, stockOf(item)) : 50;
  }

  function addToCart(
    item: MenuItem,
    input: { qty: number; unitPrice: number; spiceLevel?: string; addOnIds: string[]; addOnNames: string[]; note?: string }
  ) {
    const key = cartKey(item.id, input.spiceLevel, input.addOnIds, input.note);
    setCartEntries((prev) => {
      const existing = prev.find((e) => e.key === key);
      const max = maxQtyOf(item);
      if (existing) {
        return prev.map((e) =>
          e.key === key ? { ...e, qty: Math.min(max, e.qty + input.qty) } : e
        );
      }
      const entry: CartEntry = {
        key,
        menuItemId: item.id,
        name: item.name,
        unitPrice: input.unitPrice,
        qty: Math.min(max, input.qty),
        spiceLevel: input.spiceLevel,
        addOnIds: input.addOnIds,
        addOnNames: input.addOnNames,
        note: input.note,
      };
      return [...prev, entry];
    });
  }

  function updateCartQty(key: string, qty: number) {
    setCartEntries((prev) => {
      if (qty <= 0) return prev.filter((e) => e.key !== key);
      const entry = prev.find((e) => e.key === key);
      if (!entry) return prev;
      const item = allItems.find((i) => i.id === entry.menuItemId);
      const clamped = item ? Math.min(maxQtyOf(item), qty) : qty;
      return prev.map((e) => (e.key === key ? { ...e, qty: clamped } : e));
    });
  }

  function quickAdd(item: MenuItem) {
    addToCart(item, { qty: 1, unitPrice: item.price, addOnIds: [], addOnNames: [] });
  }
  function quickRemove(item: MenuItem) {
    const key = cartKey(item.id);
    const current = cartEntries.find((e) => e.key === key)?.qty ?? 0;
    updateCartQty(key, current - 1);
  }
  function plainQtyOf(item: MenuItem): number {
    return cartEntries.find((e) => e.key === cartKey(item.id))?.qty ?? 0;
  }

  const cartCount = cartEntries.reduce((sum, e) => sum + e.qty, 0);
  const cartTotal = cartEntries.reduce((sum, e) => sum + e.unitPrice * e.qty, 0);

  async function handleSubmitOrder(idempotencyKey: string) {
    return new Promise<{ unavailable: string[]; orderId: string | null }>((resolve) => {
      startTransition(async () => {
        const lines: CartLine[] = cartEntries.map((e) => ({
          menuItemId: e.menuItemId,
          qty: e.qty,
          note: e.note,
          spiceLevel: e.spiceLevel,
          addOnIds: e.addOnIds,
        }));
        const result = await placeOrder(token, lines, idempotencyKey);
        if (result.unavailable.length === 0) {
          setCartEntries([]);
          await refreshOrderNow();
        }
        resolve(result);
      });
    });
  }

  function handleNavSelect(tab: CustomerTab) {
    if (tab === "home") {
      scrollToGroup(ALL_GROUP_ID);
    } else if (tab === "menu") {
      const firstGroup = menuGroups[0];
      if (firstGroup) scrollToGroup(firstGroup.id);
      else scrollToGroup(ALL_GROUP_ID);
    } else if (tab === "orders") {
      setStatusOpen(true);
    } else {
      setContactOpen(true);
    }
  }

  const currentStage = order && order.items.length > 0 ? currentOrderStage(order.items) : null;
  const showBellDot = currentStage !== null && currentStage !== "served";

  return (
    <div className={`max-w-2xl mx-auto ${cartCount > 0 ? "pb-40" : "pb-24"}`}>
      <header className="sticky top-0 z-20 bg-(--surface) border-b border-(--surface-border) px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-(--brand) text-(--brand-foreground) flex items-center justify-center shrink-0">
            <DishMarkIcon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-semibold text-(--foreground) leading-tight truncate">บ้านอร่อย</p>
            <p className="text-xs text-(--text-muted) leading-tight truncate">{tableName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStatusOpen(true)}
          aria-label="สถานะออเดอร์"
          className="relative w-10 h-10 rounded-full bg-(--surface-muted) flex items-center justify-center shrink-0"
        >
          <BellIcon className="w-5 h-5 text-(--foreground)" />
          {showBellDot && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-(--cta) ring-2 ring-(--surface)" />
          )}
        </button>
      </header>

      <div className="px-4">
        {!isSearching && (
          <div className="flex items-center gap-3 py-5">
            <div className="min-w-0">
              <h1 className="page-heading">วันนี้อยากกินอะไรดี? 🍚</h1>
              <p className="text-(--text-muted) mt-1">เลือกเมนูที่ชอบ แล้วสั่งได้เลย</p>
            </div>
            <SteamingBowlIllustration className="w-20 h-20 shrink-0" />
          </div>
        )}

        <div className={`relative ${isSearching ? "py-4" : "pb-4"}`}>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted-2)" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาเมนู..."
            aria-label="ค้นหาเมนู"
            className="w-full rounded-full border border-(--surface-border) bg-(--surface) pl-11 pr-4 py-3.5 text-base placeholder:text-(--text-muted-2) focus:outline-none focus:ring-2 focus:ring-(--brand)"
          />
        </div>
      </div>

      {!isSearching && menuGroups.length > 0 && (
        <div className="sticky top-[65px] z-10 bg-(--background)/95 backdrop-blur-sm px-4 py-2.5 flex gap-2 overflow-x-auto scrollbar-none border-b border-(--surface-border)">
          <button
            ref={(el) => {
              tabRefs.current[ALL_GROUP_ID] = el;
            }}
            onClick={() => scrollToGroup(ALL_GROUP_ID)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
              activeGroupId === ALL_GROUP_ID
                ? "bg-(--brand) text-(--brand-foreground) border-(--brand)"
                : "bg-(--surface) text-(--text-subtle) border-(--accent)/25"
            }`}
          >
            ทั้งหมด
          </button>
          {menuGroups.map((group) => (
            <button
              key={group.id}
              ref={(el) => {
                tabRefs.current[group.id] = el;
              }}
              onClick={() => scrollToGroup(group.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                activeGroupId === group.id
                  ? "bg-(--brand) text-(--brand-foreground) border-(--brand)"
                  : "bg-(--surface) text-(--text-subtle) border-(--accent)/25"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      <main className="px-4 pt-5 space-y-8">
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="text-center py-14 space-y-3">
              <NoResultsDoodle className="w-24 h-24 mx-auto" />
              <p className="text-(--text-muted-2)">ไม่พบเมนูที่ค้นหา</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {searchResults.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  soldOut={isSoldOut(item)}
                  plainQty={plainQtyOf(item)}
                  onOpenDetail={() => setDetailItem(item)}
                  onQuickAdd={() => quickAdd(item)}
                  onQuickRemove={() => quickRemove(item)}
                />
              ))}
            </div>
          )
        ) : menuGroups.length === 0 ? (
          <div className="text-center py-14 space-y-3">
            <EmptyPlateDoodle className="w-24 h-24 mx-auto" />
            <p className="text-(--text-muted-2)">ตอนนี้ยังไม่มีเมนูให้สั่ง</p>
          </div>
        ) : (
          <>
            {featuredItems.length > 0 && (
              <section>
                <h2 className="section-title mb-3">เมนูแนะนำ</h2>
                <div className="grid grid-cols-2 gap-3">
                  {featuredItems.map((item) => (
                    <FoodCard
                      key={item.id}
                      item={item}
                      soldOut={isSoldOut(item)}
                      plainQty={plainQtyOf(item)}
                      onOpenDetail={() => setDetailItem(item)}
                      onQuickAdd={() => quickAdd(item)}
                      onQuickRemove={() => quickRemove(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {menuGroups.map((group) => (
              <section
                key={group.id}
                ref={(el) => {
                  sectionRefs.current[group.id] = el;
                }}
                className="scroll-mt-32"
              >
                <h2 className="section-title mb-3 flex items-center gap-2">
                  <CategoryIcon name={group.name} className="w-5 h-5 text-(--brand) shrink-0" />
                  {group.name}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <FoodCard
                      key={item.id}
                      item={item}
                      soldOut={isSoldOut(item)}
                      plainQty={plainQtyOf(item)}
                      onOpenDetail={() => setDetailItem(item)}
                      onQuickAdd={() => quickAdd(item)}
                      onQuickRemove={() => quickRemove(item)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      {cartCount > 0 && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-20 px-4">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="w-full bg-(--cta) text-white rounded-2xl py-3.5 px-5 font-semibold flex items-center justify-between shadow-[0_10px_30px_rgb(0_0_0_/_0.2)] active:scale-[0.98] transition-transform"
            >
              <span>🛒 {cartCount} รายการ</span>
              <span className="flex items-center gap-1.5">
                {formatBaht(cartTotal)} บาท
                <span aria-hidden="true">→</span>
              </span>
            </button>
          </div>
        </div>
      )}

      <CustomerBottomNav active={null} onSelect={handleNavSelect} />

      {detailItem && (
        <FoodDetailSheet
          key={detailItem.id}
          item={detailItem}
          maxQty={maxQtyOf(detailItem)}
          onClose={() => setDetailItem(null)}
          onAddToCart={(input) => addToCart(detailItem, input)}
        />
      )}

      <CartFlowSheet
        open={cartOpen}
        entries={cartEntries}
        tableName={tableName}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onSubmit={handleSubmitOrder}
        onViewStatus={() => setStatusOpen(true)}
      />

      <OrderStatusSheet open={statusOpen} order={order} onClose={() => setStatusOpen(false)} />

      <ContactSheet open={contactOpen} tableName={tableName} onClose={() => setContactOpen(false)} />
    </div>
  );
}
