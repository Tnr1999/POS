export type StockStatus = "unlimited" | "ok" | "low" | "out";

const LOW_STOCK_THRESHOLD = 5;

/**
 * Single source of truth for the 🟢/🟡/🔴 stock indicator — used by
 * /admin/menu, /admin/stock, /pos, /pos/new, and the customer order page so
 * they all agree on what counts as "low" instead of each re-deriving
 * `stock <= 5` inline with slightly different styling.
 */
export function stockStatusOf(item: { trackStock: boolean; stock: number }): StockStatus {
  if (!item.trackStock) return "unlimited";
  if (item.stock <= 0) return "out";
  if (item.stock <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}
