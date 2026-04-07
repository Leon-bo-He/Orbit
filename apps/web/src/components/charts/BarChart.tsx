interface BarChartDataItem {
  label: string;
  value: number;
  secondaryValue?: number;
}

export interface BarChartProps {
  data: BarChartDataItem[];
  height?: number;
  color?: string;
  secondaryColor?: string;
  showSecondary?: boolean;
}

const PADDING = { top: 16, right: 16, bottom: 48, left: 40 };

export function BarChart({
  data,
  height = 200,
  color = '#6366f1',
  secondaryColor = '#f59e0b',
  showSecondary = false,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-gray-400 text-sm"
      >
        No data
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxSecondary = showSecondary
    ? Math.max(...data.map((d) => d.secondaryValue ?? 0), 1)
    : 1;

  const chartWidth = 600; // internal SVG coords
  const chartHeight = height;
  const innerWidth = chartWidth - PADDING.left - PADDING.right;
  const innerHeight = chartHeight - PADDING.top - PADDING.bottom;

  const barWidth = Math.max(4, (innerWidth / data.length) * 0.6);
  const barGap = innerWidth / data.length;

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    value: Math.round(maxValue * t),
    y: innerHeight - innerHeight * t,
  }));

  const rotateLabels = data.length > 6;

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      style={{ width: '100%', height }}
      role="img"
      aria-label="Bar chart"
    >
      {/* Y-axis gridlines */}
      {yTicks.map((tick) => (
        <g key={tick.value} transform={`translate(${PADDING.left}, ${PADDING.top})`}>
          <line
            x1={0}
            y1={tick.y}
            x2={innerWidth}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={-6}
            y={tick.y}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            {tick.value >= 1000 ? `${Math.round(tick.value / 1000)}k` : tick.value}
          </text>
        </g>
      ))}

      {/* Bars and X-axis labels */}
      {data.map((item, i) => {
        const barH = Math.max(2, (item.value / maxValue) * innerHeight);
        const x = PADDING.left + i * barGap + barGap / 2 - barWidth / 2;
        const y = PADDING.top + innerHeight - barH;
        const labelX = PADDING.left + i * barGap + barGap / 2;
        const labelY = chartHeight - PADDING.bottom + 8;

        // Secondary line point
        const secVal = item.secondaryValue ?? 0;
        const secY = PADDING.top + innerHeight - (secVal / maxSecondary) * innerHeight;

        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={color}
              opacity={0.85}
              rx={2}
            />
            {/* Secondary dot (drawn separately, line drawn below) */}
            {showSecondary && (
              <circle
                cx={labelX}
                cy={secY}
                r={3}
                fill={secondaryColor}
              />
            )}
            {/* X-axis label */}
            <text
              x={labelX}
              y={labelY}
              textAnchor={rotateLabels ? 'end' : 'middle'}
              fontSize={10}
              fill="#6b7280"
              transform={
                rotateLabels
                  ? `rotate(-45, ${labelX}, ${labelY})`
                  : undefined
              }
            >
              {item.label}
            </text>
          </g>
        );
      })}

      {/* Secondary line */}
      {showSecondary && data.length > 1 && (
        <polyline
          fill="none"
          stroke={secondaryColor}
          strokeWidth={2}
          points={data
            .map((item, i) => {
              const secVal = item.secondaryValue ?? 0;
              const cx = PADDING.left + i * barGap + barGap / 2;
              const cy = PADDING.top + innerHeight - (secVal / maxSecondary) * innerHeight;
              return `${cx},${cy}`;
            })
            .join(' ')}
        />
      )}

      {/* Axes */}
      <line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={PADDING.top + innerHeight}
        stroke="#d1d5db"
        strokeWidth={1}
      />
      <line
        x1={PADDING.left}
        y1={PADDING.top + innerHeight}
        x2={PADDING.left + innerWidth}
        y2={PADDING.top + innerHeight}
        stroke="#d1d5db"
        strokeWidth={1}
      />
    </svg>
  );
}
