import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import {
  buildMealTimeline,
  currentMealStatus,
  missingMealDates,
  removeMealRecord,
  upsertMealRecord,
} from '../../domain/mealV2';
import type { MealDay } from '../../domain/mealV2';
import { centsToYuan, formatSignedYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { BeanMascot } from '../components/BeanMascot';
import type { MascotState } from '../components/BeanMascot';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
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
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button--primary" type="submit">{record ? '更新今日记录' : '保存'}</button>
    </form>
  );
}

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
        {day.switchedToMinimum && <span className="badge badge--danger">自由额度用完</span>}
      </div>
      <div className="list-row__amounts">
        <span>额度 {formatYuan(day.allowance)} · 花 {formatYuan(day.spent)}</span>
        <span className={day.dailyBalance >= 0 ? 'positive' : 'negative'}>当日 {formatSignedYuan(day.dailyBalance)}</span>
        <span className="muted">累计 {formatYuan(day.balanceAfter)}</span>
      </div>
      <div className="list-row__actions">
        <button type="button" className="text-button" aria-label={`编辑 ${formatDisplayDate(day.date)}`} onClick={() => onEdit(day.date)}>
          编辑
        </button>
        <button type="button" className="text-button text-button--danger" aria-label={`删除 ${formatDisplayDate(day.date)}`} onClick={() => onDelete(day.date)}>
          删除
        </button>
      </div>
    </div>
  );
}

export function MealPage() {
  const { state, saveRecord, deleteRecord } = useMeal();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const timeline = buildMealTimeline(state, today);
  const periods = [...timeline].reverse();
  const missing = missingMealDates(state, today);
  const todayRecord = state.records[today];
  const recordedDays = timeline.reduce((total, period) => total + period.days.length, 0);

  const previousMode = useRef(status.mode);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [editing, setEditing] = useState<{ date: string; spent: string; note: string; error: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    if (previousMode.current === 'normal' && status.mode === 'minimum') {
      setThresholdOpen(true);
    }
    previousMode.current = status.mode;
  }, [status.mode]);

  const mascotState: MascotState = status.mode === 'minimum' ? 'worried' : status.balance < 0 ? 'sad' : 'happy';
  const cardTone = status.mode === 'minimum' ? 'minimum' : status.balance < 0 ? 'sad' : 'happy';

  const openEdit = (date: string) => {
    const record = state.records[date];
    if (!record) return;
    setEditing({ date, spent: centsToYuan(record.spent), note: record.note ?? '', error: '' });
  };

  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const cents = parseYuanToCents(editing.spent);
    if (cents === null) {
      setEditing({ ...editing, error: '请输入有效金额' });
      return;
    }
    const nextState = upsertMealRecord(state, editing.date, cents, editing.note, new Date().toISOString());
    const action = () => saveRecord(editing.date, cents, editing.note);
    if (currentMealStatus(nextState, today).mode !== status.mode) {
      setConfirmMessage('这次修改会改变当前阶段，确认继续吗？');
      setPendingAction(() => action);
    } else {
      action();
    }
    setEditing(null);
  };

  const requestDelete = (date: string) => {
    const nextState = removeMealRecord(state, date);
    const nextMode = currentMealStatus(nextState, today).mode;
    setConfirmMessage(nextMode !== status.mode ? '删除会改变当前阶段，仍要删除吗？' : '删除后余额与阶段会重新计算。');
    setPendingAction(() => () => deleteRecord(date));
  };

  return (
    <div className="page">
      <section className={`balance-card balance-card--${cardTone}`}>
        <div style={{ maxWidth: '62%', position: 'relative', zIndex: 1 }}>
          <span className="balance-card__label">当前可用余额</span>
          <strong className={`balance-card__amount${status.balance < 0 ? ' is-negative' : ''}`}>{formatYuan(status.balance)}</strong>
          <span className="status-pill">
            {status.mode === 'minimum'
              ? `保底 ${formatYuan(status.dailyMinimum)}/天 · 无自由额度`
              : `${formatYuan(status.dailyNormal)}/天 · 距保底 ${formatYuan(status.distanceToMinimum)}`}
          </span>
          <div className="balance-card__meta">
            已记录 {recordedDays} 天 · 本周期 {formatDisplayDate(status.startDate)} 起
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 600 }}>
            {status.mode === 'minimum'
              ? '没有多余的钱可以随意消费'
              : status.balance < 0
                ? '有点超支了…'
                : '真棒！今天也攒下啦'}
          </p>
        </div>
        <div style={{ position: 'absolute', right: 12, bottom: 0 }}>
          <BeanMascot state={mascotState} />
        </div>
        {status.mode === 'normal' ? (
          <div className="free-quota">
            <div className="free-quota__label">
              <span>自由额度剩余</span>
              <span>{formatYuan(status.freeRemaining)} / {formatYuan(status.freeAllowance)}</span>
            </div>
            <div className="free-quota__track">
              <div
                className="free-quota__fill"
                style={{ width: `${Math.min(100, Math.max(0, (status.freeRemaining / status.freeAllowance) * 100))}%` }}
              />
            </div>
          </div>
        ) : (
          <p style={{ margin: '18px 0 0', fontSize: 12, opacity: 0.85 }}>
            自由额度已用完，接下来每天按 {formatYuan(status.dailyMinimum)} 计算。
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">今天 {formatDisplayDate(today)} · 额度 {formatYuan(status.dailyAllowance)}</h2>
        <TodayForm key={todayRecord?.updatedAt ?? 'empty'} record={todayRecord} onSave={(spent, note) => saveRecord(today, spent, note)} />
        {todayRecord && <p className="muted">今日已记录，花费 {formatYuan(todayRecord.spent)}</p>}
      </section>

      {missing.length > 0 && (
        <Link className="banner banner--warning" to="/meal/backfill">
          ⚠ 还有 {missing.length} 天未记录，去补记 ›
        </Link>
      )}

      <section className="card summary-grid">
        <div><span className="muted">本周期花费</span><strong>{formatYuan(timeline[timeline.length - 1]?.totalSpent ?? 0)}</strong></div>
        <div><span className="muted">本周期额度</span><strong>{formatYuan(timeline[timeline.length - 1]?.totalAllowance ?? 0)}</strong></div>
        <div><span className="muted">当前阶段</span><strong>{status.switchDate ? '保底 15 元' : '正常 20 元'}</strong></div>
        <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>周期记录</h2><span className="muted">按恢复周期</span></div>
        {periods.length === 0 ? (
          <EmptyState title="还没有记录" hint="记下今天的花费，开始攒结余。" />
        ) : (
          periods.map((period) => (
            <div className="card" key={period.restore.id}>
              <div className="period-heading">
                <strong>{formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}</strong>
                <div>
                  {period.switchDate && <span className="mode-badge mode-badge--minimum">15 元阶段</span>}
                  <span className="mode-badge">{formatYuan(period.restore.dailyNormal)}/天</span>
                </div>
              </div>
              <div className="period-meta">
                花 {formatYuan(period.totalSpent)} · 结束余额 {formatYuan(period.endingBalance)} · 结转 {period.carry > 0 ? formatYuan(period.carry) : '已清零'}
              </div>
              {period.days.length === 0 ? (
                <p className="muted">这个周期还没有记录。</p>
              ) : (
                [...period.days].reverse().map((day) => (
                  <RecordRow key={day.date} day={day} onEdit={openEdit} onDelete={requestDelete} />
                ))
              )}
            </div>
          ))
        )}
      </section>

      {editing && (
        <Sheet open title="修改记录" onClose={() => setEditing(null)}>
          <form className="form" onSubmit={submitEdit}>
            <label className="field">
              <span>{formatDisplayDate(editing.date)} 花费</span>
              <MoneyInput value={editing.spent} onChange={(value) => setEditing({ ...editing, spent: value, error: '' })} ariaLabel="修改金额" />
            </label>
            <label className="field">
              <span>备注（可选）</span>
              <input
                type="text"
                value={editing.note}
                onChange={(event) => setEditing({ ...editing, note: event.target.value, error: '' })}
                aria-label="修改备注"
              />
            </label>
            {editing.error && <p className="form-error" role="alert">{editing.error}</p>}
            <button className="button button--primary" type="submit">保存修改</button>
          </form>
        </Sheet>
      )}

      {pendingAction && (
        <ConfirmDialog
          open
          title="确认操作"
          message={confirmMessage}
          confirmLabel="确认"
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            pendingAction();
            setPendingAction(null);
          }}
        />
      )}

      <Sheet open={thresholdOpen} title="自由额度用完了" onClose={() => setThresholdOpen(false)}>
        <div className="threshold-message">
          <BeanMascot state="sad" className="mascot--sm" />
          <p>
            没有多余的钱可以随意消费了。接下来每天按{' '}
            {formatYuan(timeline[timeline.length - 1]?.restore.dailyMinimum ?? 1500)} 计算。
          </p>
          <button type="button" className="button button--primary" onClick={() => setThresholdOpen(false)}>
            知道了
          </button>
        </div>
      </Sheet>
    </div>
  );
}
