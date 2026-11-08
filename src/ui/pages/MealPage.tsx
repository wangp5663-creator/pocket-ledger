import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import {
  buildMealTimeline,
  currentMealStatus,
  formatMealDeficitHint,
  mealDeficitHint,
  missingMealDates,
} from '../../domain/mealV2';
import { centsToYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { BeanMascot } from '../components/BeanMascot';
import type { MascotState } from '../components/BeanMascot';
import { EntryLink } from '../components/EntryLink';
import { MoneyInput } from '../components/MoneyInput';
import { Sheet } from '../components/Sheet';

function TodayForm({
  record,
  onSave,
}: {
  record?: { spent: number; note?: string };
  onSave: (spent: number, note: string) => void;
}) {
  const [spent, setSpent] = useState(record ? centsToYuan(record.spent) : '');
  const [note, setNote] = useState(record?.note ?? '');
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(spent);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    setError('');
    onSave(cents, note);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>今日实际花费</span>
        <MoneyInput value={spent} onChange={setSpent} ariaLabel="今日实际花费" />
      </label>
      <label className="field">
        <span>备注（可选）</span>
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} aria-label="今日备注" />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--primary" type="submit">
        保存
      </button>
    </form>
  );
}

export function MealPage() {
  const { state, saveRecord } = useMeal();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const timeline = buildMealTimeline(state, today);
  const periods = [...timeline].filter((period) => period.startDate <= today).reverse();
  const missing = missingMealDates(state, today);
  const todayRecord = state.records[today];
  const recordedDays = timeline.reduce((total, period) => total + period.days.length, 0);
  const deficitMessage = formatMealDeficitHint(mealDeficitHint(status, today));

  const previousMode = useRef(status.mode);
  const [thresholdOpen, setThresholdOpen] = useState(false);

  useEffect(() => {
    if (previousMode.current === 'normal' && status.mode === 'minimum') {
      setThresholdOpen(true);
    }
    previousMode.current = status.mode;
  }, [status.mode]);

  const mascotState: MascotState = status.mode === 'minimum' ? 'worried' : status.balance < 0 ? 'sad' : 'happy';
  const cardTone = status.mode === 'minimum' ? 'minimum' : status.balance < 0 ? 'sad' : 'happy';

  return (
    <div className="page">
      <section className={`balance-card balance-card--${cardTone}`}>
        <div className="balance-card__body">
          <div className="balance-card__text">
            <span className="balance-card__label">当前结余</span>
            <strong className={`balance-card__amount${status.balance < 0 ? ' is-negative' : ''}`}>
              {formatYuan(status.balance)}
            </strong>
            <span className="status-pill">
              {status.mode === 'minimum'
                ? `保底 ${formatYuan(status.dailyMinimum)}/天 · 无自由额度`
                : `正常 ${formatYuan(status.dailyNormal)}/天 · 距保底 ${formatYuan(status.distanceToMinimum)}`}
            </span>
            <div className="balance-card__meta">
              已记录 {recordedDays} 天 · {formatDisplayDate(status.startDate)} 起
            </div>
            <p className="balance-card__message">
              {deficitMessage ?? (status.mode === 'minimum' ? '自由额度已用完' : '真棒！今天也攒下啦')}
            </p>
          </div>
          <div className="balance-card__mascot">
            <BeanMascot state={mascotState} />
          </div>
        </div>
        {status.mode === 'normal' ? (
          <div className="free-quota">
            <div className="free-quota__label">
              <span>自由额度剩余</span>
              <span>
                {formatYuan(status.freeRemaining)} / {formatYuan(status.freeAllowance)}
              </span>
            </div>
            <div
              className="free-quota__track"
              role="progressbar"
              aria-label="自由额度剩余"
              aria-valuemin={0}
              aria-valuemax={status.freeAllowance}
              aria-valuenow={status.freeRemaining}
            >
              <div
                className="free-quota__fill"
                style={{
                  width: `${Math.min(100, Math.max(0, (status.freeRemaining / status.freeAllowance) * 100))}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="balance-card__note">
            自由额度已用完，接下来每天按保底额度 {formatYuan(status.dailyMinimum)} 计算。
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">
          今天 {formatDisplayDate(today)} · 额度 {formatYuan(status.dailyAllowance)}
        </h2>
        <TodayForm
          key={todayRecord?.updatedAt ?? 'empty'}
          record={todayRecord}
          onSave={(spent, note) => saveRecord(today, spent, note)}
        />
        {todayRecord && <p className="muted">今日已记录，花费 {formatYuan(todayRecord.spent)}</p>}
      </section>

      {missing.length > 0 && (
        <Link className="banner banner--warning" to="/meal/backfill">
          ⚠ 还有 {missing.length} 天未记录，去补记 ›
        </Link>
      )}

      <section className="card summary-grid">
        <div>
          <span className="muted">本周期花费</span>
          <strong>{formatYuan(timeline[timeline.length - 1]?.totalSpent ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">本周期总额度</span>
          <strong>{formatYuan(timeline[timeline.length - 1]?.totalAllowance ?? 0)}</strong>
        </div>
        <div>
          <span className="muted">当前阶段</span>
          <strong>
            {status.switchDate
              ? `保底阶段 ${formatYuan(status.dailyMinimum)}/天`
              : `正常阶段 ${formatYuan(status.dailyNormal)}/天`}
          </strong>
        </div>
        <div>
          <span className="muted">自由额度</span>
          <strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong>
        </div>
      </section>

      <EntryLink
        to="/meal/records"
        title="历史周期"
        detail={
          periods.length > 0
            ? `${periods.length} 个周期 · 最近 ${formatDisplayDate(periods[0].startDate)}–${formatDisplayDate(periods[0].endDate)}`
            : '还没有周期记录'
        }
      />

      <Sheet open={thresholdOpen} title="自由额度已用完" onClose={() => setThresholdOpen(false)}>
        <div className="threshold-message">
          <BeanMascot state="sad" className="mascot--sm" />
          <p>自由额度已用完，接下来每天按保底额度 {formatYuan(status.dailyMinimum)} 计算。</p>
          <button type="button" className="button button--primary" onClick={() => setThresholdOpen(false)}>
            知道了
          </button>
        </div>
      </Sheet>
    </div>
  );
}
