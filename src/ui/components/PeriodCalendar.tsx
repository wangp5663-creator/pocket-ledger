import { useState } from 'react';
import {
  addMonths,
  daysInMonth,
  formatDisplayDate,
  formatMonthLabel,
  monthOf,
  parseDateKey,
} from '../../domain/dates';

interface PeriodCalendarProps {
  initialStart: string;
  initialEnd: string;
  today: string;
  onConfirm: (startDate: string, endDate: string) => void;
  onCancel: () => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function PeriodCalendar({
  initialStart,
  initialEnd,
  today,
  onConfirm,
  onCancel,
}: PeriodCalendarProps) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [viewMonth, setViewMonth] = useState(monthOf(initialStart));

  const days = daysInMonth(viewMonth);
  const firstWeekday = parseDateKey(`${viewMonth}-01`).getDay();
  const cells: Array<string | null> = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= days ? `${viewMonth}-${String(day).padStart(2, '0')}` : null;
  });

  const selectDate = (date: string) => {
    if (!start || (start && end && start !== end)) {
      setStart(date);
      setEnd(date);
      return;
    }
    if (date < start) {
      setStart(date);
      setEnd(start);
      return;
    }
    setEnd(date);
  };

  return (
    <div className="period-calendar">
      <p className="muted">
        开始 {formatDisplayDate(start)} · 结束 {formatDisplayDate(end)}
      </p>
      <div className="period-calendar__nav">
        <button type="button" className="icon-button" aria-label="上个月" onClick={() => setViewMonth(addMonths(viewMonth, -1))}>
          ‹
        </button>
        <strong>{formatMonthLabel(viewMonth)}</strong>
        <button type="button" className="icon-button" aria-label="下个月" onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
          ›
        </button>
      </div>
      <div className="period-calendar__grid">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="period-calendar__weekday">{weekday}</span>
        ))}
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} />;
          const inRange = start && end && date >= start && date <= end;
          const selected = date === start || date === end;
          return (
            <button
              key={date}
              type="button"
              className={[
                'period-calendar__day',
                inRange ? 'is-in-range' : '',
                selected ? 'is-selected' : '',
                date === today ? 'is-today' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => selectDate(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
      <div className="sheet-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>取消</button>
        <button
          type="button"
          className="button button--primary"
          disabled={!start || !end || start > end}
          onClick={() => onConfirm(start, end)}
        >
          保存周期
        </button>
      </div>
    </div>
  );
}
