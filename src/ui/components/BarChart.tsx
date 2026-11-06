import type { CSSProperties } from 'react';

interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  color?: string;
  ariaLabel?: string;
}

export function BarChart({ data, color = 'var(--meal-primary)', ariaLabel = '月度趋势图' }: BarChartProps) {
  if (data.length === 0) return null;
  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  const hasNegative = data.some((item) => item.value < 0);
  const factor = hasNegative ? 50 : 100;

  return (
    <div className={`bar-chart${hasNegative ? ' bar-chart--split' : ''}`} role="img" aria-label={ariaLabel}>
      {data.map((item, index) => {
        const negative = item.value < 0;
        const height = Math.max(2, (Math.abs(item.value) / maxAbs) * factor);
        const style: CSSProperties = {
          height: `${height}%`,
          background: negative ? 'var(--danger)' : color,
        };
        if (negative) {
          style.top = '50%';
        } else {
          style.bottom = hasNegative ? '50%' : 0;
        }
        return (
          <div className="bar-chart__item" key={`${item.label}-${index}`}>
            <div className="bar-chart__track">
              {hasNegative && <div className="bar-chart__axis" />}
              <div className={`bar-chart__bar${negative ? ' bar-chart__bar--negative' : ''}`} style={style} />
            </div>
            <span className="bar-chart__label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
