import { Badge } from "./Badge";
import { stockStatusOf, type StockStatus } from "@/lib/stockStatus";

// Never color-only — every state pairs a dot + a text label per the design
// brief's accessibility note.
const STATUS_CONFIG: Record<StockStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral"; dot: string }> = {
  unlimited: { label: "ไม่จำกัด", tone: "neutral", dot: "bg-(--text-muted-2)" },
  ok: { label: "ปกติ", tone: "success", dot: "bg-(--text-success)" },
  low: { label: "ใกล้หมด", tone: "warning", dot: "bg-(--text-warning)" },
  out: { label: "หมด", tone: "danger", dot: "bg-(--text-danger)" },
};

export function StockStatusBadge({
  item,
  showQty,
}: {
  item: { trackStock: boolean; stock: number };
  showQty?: boolean;
}) {
  const status = stockStatusOf(item);
  const config = STATUS_CONFIG[status];

  return (
    <Badge tone={config.tone}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`} aria-hidden="true" />
      {config.label}
      {showQty && status !== "unlimited" ? ` (${item.stock})` : ""}
    </Badge>
  );
}
