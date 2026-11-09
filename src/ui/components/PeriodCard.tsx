import { formatDisplayDate, formatPeriodRange } from '../../domain/dates';
import type { MealDay, MealPeriod } from '../../domain/mealV2';
import { formatSignedYuan, formatYuan } from '../../domain/money';

function RecordRow({
  day,
  onEdit,
  onDelete,
}: {
  day: MealDay;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(day.date)}</span>
        {day.note && <span className="list-row__note">{day.note}</span>}
        {day.switchedToMinimum && <span className="badge badge--danger">自由额度已用完</span>}
      </div>
      <div className="list-row__amounts record-row__amounts">
        <span>额度 {formatYuan(day.allowance)} · 花费 {formatYuan(day.spent)}</span>
        <div className="record-row__balances">
          <span className="muted">当日结余</span>
          <span className={day.dailyBalance >= 0 ? 'positive' : 'negative'}>
            {formatSignedYuan(day.dailyBalance)}
          </span>
          <span className="muted">累计结余</span>
          <span>{formatYuan(day.balanceAfter)}</span>
        </div>
      </div>
      <div className="list-row__actions">
        <button
          type="button"
          className="text-button"
          aria-label={`编辑 ${formatDisplayDate(day.date)}`}
          onClick={() => onEdit(day.date)}
        >
          编辑
        </button>
        <button
          type="button"
          className="text-button text-button--danger"
          aria-label={`删除 ${formatDisplayDate(day.date)}`}
          onClick={() => onDelete(day.date)}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export function PeriodCard({
  period,
  onEdit,
  onDelete,
}: {
  period: MealPeriod;
  onEdit: (date: string) => void;
  onDelete: (date: string) => void;
}) {
  return (
    <div className="card">
      <div className="period-heading">
        <strong>{formatPeriodRange(period.startDate, period.endDate)}</strong>
        <div>
          {period.switchDate && (
            <span className="mode-badge mode-badge--minimum">保底 {formatYuan(period.restore.dailyMinimum)}</span>
          )}
          <span className="mode-badge">{formatYuan(period.restore.dailyNormal)}/天</span>
        </div>
      </div>
      <div className="period-meta">
        花费 {formatYuan(period.totalSpent)} · 期末余额 {formatYuan(period.endingBalance)} · 结转{' '}
        {period.carry > 0 ? formatYuan(period.carry) : '已清零'}
      </div>
      {period.days.length === 0 ? (
        <p className="muted">这个周期还没有记录。</p>
      ) : (
        [...period.days].reverse().map((day) => (
          <RecordRow key={day.date} day={day} onEdit={onEdit} onDelete={onDelete} />
        ))
      )}
    </div>
  );
}
