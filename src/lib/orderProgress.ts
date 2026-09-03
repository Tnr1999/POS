/**
 * Derives a customer-facing 4-stage timeline from real per-item statuses
 * (PENDING/PREPARING/SERVED — see OrderItem.status in schema.prisma).
 * There's no separate "currently serving" status in the data model, so
 * "กำลังเสิร์ฟ" is inferred as "at least one item served, not all yet" —
 * an honest aggregation of real state, not a fabricated stage.
 */

export type OrderStage = "received" | "preparing" | "serving" | "served";

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  received: "รับออเดอร์แล้ว",
  preparing: "กำลังเตรียมอาหาร",
  serving: "กำลังเสิร์ฟ",
  served: "เสิร์ฟแล้ว",
};

export const ORDER_STAGES: OrderStage[] = ["received", "preparing", "serving", "served"];

export function currentOrderStage(items: { status: string }[]): OrderStage {
  if (items.length === 0) return "received";

  const allServed = items.every((i) => i.status === "SERVED");
  if (allServed) return "served";

  const someServed = items.some((i) => i.status === "SERVED");
  if (someServed) return "serving";

  const anyStarted = items.some((i) => i.status === "PREPARING" || i.status === "SERVED");
  if (anyStarted) return "preparing";

  return "received";
}

export function stageIndex(stage: OrderStage): number {
  return ORDER_STAGES.indexOf(stage);
}
