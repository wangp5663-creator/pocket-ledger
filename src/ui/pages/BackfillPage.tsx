import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDisplayDate, formatMonthLabel, monthOf, todayKey } from '../../domain/dates';
import { missingDates } from '../../domain/meal';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { EmptyState } from '../components/EmptyState';
import { MoneyInput } from '../components/MoneyInput';

function BackfillRow({ date }: { date: string }) {
  const { state, saveRecord } = useMeal();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const cents = parseYuanToCents(amount);
    if (cents === null) {
      setError('请输入有效金额');
      return;
    }
    saveRecord(date, cents, note, state.settings.dailyAllowance);
  };

  return (
    <div className="list-row">
      <div className="list-row__main">
        <span className="list-row__title">{formatDisplayDate(date)}</span>
      </div>
      <div className="backfill-row">
        <MoneyInput value={amount} onChange={setAmount} ariaLabel={`${date} 金额`} />
        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="备注"
          aria-label={`${date} 备注`}
        />
        <button type="button" className="button button--secondary" onClick={save} aria-label={`保存 ${date}`}>
          保存
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BackfillPage() {
  const { state } = useMeal();
  const today = todayKey();
  const dates = [...missingDates(state, today)].reverse();
  const groups = dates.reduce<Record<string, string[]>>((accumulator, date) => {
    const month = monthOf(date);
    (accumulator[month] ??= []).push(date);
    return accumulator;
  }, {});

  return (
    <div className="page">
      <div className="page-nav">
        <Link className="text-button" to="/">
          ‹ 返回餐补
        </Link>
      </div>
      <h1>补记</h1>
      {dates.length === 0 ? (
        <EmptyState title="没有需要补记的日期" hint="所有日子都记录好了。" />
      ) : (
        Object.entries(groups).map(([month, monthDates]) => (
          <section className="card" key={month}>
            <h2 className="card-title">{formatMonthLabel(month)}</h2>
            {monthDates.map((date) => (
              <BackfillRow key={date} date={date} />
            ))}
          </section>
        ))
      )}
    </div>
  );
}
