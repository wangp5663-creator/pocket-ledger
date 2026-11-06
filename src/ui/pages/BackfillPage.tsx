import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { currentMealStatus, missingMealDates, upsertMealRecord } from '../../domain/mealV2';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';

function BackfillRow({ date, onSave }: { date: string; onSave: (date: string, spent: number, note: string) => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const cents = parseYuanToCents(amount);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    setError('');
    onSave(date, cents, note);
  };

  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(date)}</span>
      </div>
      <div className="backfill-row">
        <MoneyInput value={amount} onChange={setAmount} ariaLabel={`${date} 金额`} />
        <input type="text" value={note} onChange={(event) => setNote(event.target.value)} placeholder="备注" aria-label={`${date} 备注`} />
        <button type="button" className="button button--secondary" onClick={save} aria-label={`保存 ${date}`}>
          保存
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

export function BackfillPage() {
  const { state, saveRecord } = useMeal();
  const today = todayKey();
  const dates = [...missingMealDates(state, today)].reverse();
  const [pending, setPending] = useState<{ message: string; action: () => void } | null>(null);
  const groups = dates.reduce<Record<string, string[]>>((accumulator, date) => {
    const month = monthOf(date);
    (accumulator[month] ??= []).push(date);
    return accumulator;
  }, {});

  const saveWithGuard = (date: string, spent: number, note: string) => {
    const nextState = upsertMealRecord(state, date, spent, note, new Date().toISOString());
    const action = () => saveRecord(date, spent, note);
    if (currentMealStatus(nextState, today).mode !== currentMealStatus(state, today).mode) {
      setPending({ message: '补记会改变当前阶段，确认继续吗？', action });
    } else {
      action();
    }
  };

  return (
    <div className="page">
      <div className="page-nav">
        <Link className="text-button" to="/">‹ 返回餐补</Link>
      </div>
      <h1>补记</h1>
      {dates.length === 0 ? (
        <EmptyState title="没有需要补记的日期" hint="所有日子都记录好了。" />
      ) : (
        Object.entries(groups).map(([month, monthDates]) => (
          <section className="card" key={month}>
            <h2 className="card-title">{formatMonthLabel(month)}</h2>
            {monthDates.map((date) => (
              <BackfillRow key={date} date={date} onSave={saveWithGuard} />
            ))}
          </section>
        ))
      )}
      {pending && (
        <ConfirmDialog
          open
          title="确认补记"
          message={pending.message}
          confirmLabel="确认"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            pending.action();
            setPending(null);
          }}
        />
      )}
    </div>
  );
}
