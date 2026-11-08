import { useState } from 'react';
import type { FormEvent } from 'react';
import { addMonths, monthOf, todayKey } from '../../domain/dates';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import { validatePlanItemDraft } from '../../domain/planItems';
import type { PlanItemDraft } from '../../domain/planItems';
import { MoneyInput } from './MoneyInput';

interface PlanFormProps {
  initial?: PlanItemDraft;
  submitLabel: string;
  onSubmit: (draft: PlanItemDraft) => void;
}

export function PlanForm({ initial, submitLabel, onSubmit }: PlanFormProps) {
  const currentMonth = monthOf(todayKey());
  const [spendMonth, setSpendMonth] = useState(initial?.spendMonth ?? currentMonth);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial ? centsToYuan(initial.amount) : '');
  const [replenishMonth, setReplenishMonth] = useState(
    initial?.replenishMonth ?? addMonths(currentMonth, 1),
  );
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const draft: PlanItemDraft = {
      spendMonth,
      title: title.trim(),
      amount: parseYuanToCents(amount) ?? 0,
      replenishMonth,
    };
    const message = validatePlanItemDraft(draft);
    if (message) {
      setError(message);
      return;
    }
    setError('');
    onSubmit(draft);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>支出月份</span>
        <input
          type="month"
          value={spendMonth}
          onChange={(event) => setSpendMonth(event.target.value)}
          aria-label="支出月份"
        />
      </label>
      <label className="field">
        <span>事件内容</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：换电脑"
          aria-label="事件内容"
        />
      </label>
      <label className="field">
        <span>金额</span>
        <MoneyInput value={amount} onChange={setAmount} ariaLabel="金额" />
      </label>
      <label className="field">
        <span>回补月份</span>
        <input
          type="month"
          value={replenishMonth}
          onChange={(event) => setReplenishMonth(event.target.value)}
          aria-label="回补月份"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button--planning" type="submit">
        {submitLabel}
      </button>
    </form>
  );
}
