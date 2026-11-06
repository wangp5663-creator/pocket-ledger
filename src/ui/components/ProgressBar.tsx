interface ProgressBarProps {
  value: number;
  tone?: 'green' | 'indigo';
}

export function ProgressBar({ value, tone = 'indigo' }: ProgressBarProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const percent = Math.max(0, Math.min(100, safeValue));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
