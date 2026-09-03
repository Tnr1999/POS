import { formatBaht } from "@/lib/money";

type Day = { label: string; revenue: number };

/** Plain hand-rolled SVG bar chart — no charting library, kept deliberately simple. */
export function DailyRevenueChart({ days }: { days: Day[] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const barWidth = 28;
  const gap = 12;
  const chartHeight = 140;
  const width = days.length * (barWidth + gap) + gap;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${Math.max(width, 280)} ${chartHeight + 36}`}
        width={Math.max(width, 280)}
        height={chartHeight + 36}
        role="img"
        aria-label="กราฟยอดขายรายวัน"
      >
        {days.map((day, i) => {
          const barHeight = Math.round((day.revenue / max) * chartHeight);
          const x = gap + i * (barWidth + gap);
          const y = chartHeight - barHeight;
          return (
            <g key={i}>
              <title>{`${day.label}: ${formatBaht(day.revenue)} บาท`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={4}
                fill={day.revenue > 0 ? "var(--brand)" : "var(--surface-border)"}
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight + 18}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted-2)"
              >
                {day.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
