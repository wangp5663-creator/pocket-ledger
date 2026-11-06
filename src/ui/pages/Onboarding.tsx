import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { deriveRates } from '../../domain/mealV2';
import { formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { MoneyInput } from '../components/MoneyInput';

export function Onboarding() {
  const { updateSettings } = useMeal();
  const [budget, setBudget] = useState('600');
  const [minimum, setMinimum] = useState('450');
  const [startDate, setStartDate] = useState(todayKey());
  const [error, setError] = useState('');

  const budgetCents = parseYuanToCents(budget);
  const minimumCents = parseYuanToCents(minimum);
  const valid = budgetCents !== null && minimumCents !== null && budgetCents > minimumCents;
  const rates = valid
    ? deriveRates({ monthlyBudget: budgetCents, monthlyMinimum: minimumCents, startDate })
    : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (budgetCents === null || minimumCents === null) {
      setError('请输入有效金额');
      return;
    }
    if (!startDate || startDate > todayKey()) {
      setError('请选择不晚于今天的起始日期');
      return;
    }
    const message = updateSettings({
      monthlyBudget: budgetCents,
      monthlyMinimum: minimumCents,
      startDate,
    });
    if (message) {
      setError(message);
      return;
    }
    setError('');
  };

  return (
    <div className="onboarding">
      <div className="onboarding__hero">
        <p className="eyebrow">小账本</p>
        <h1>把每天的结余，攒成一笔可用的钱</h1>
        <p className="muted">先设置月度预算、保底和起始日期。</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>月度餐补预算</span>
          <MoneyInput
            value={budget}
            onChange={(value) => {
              setBudget(value);
              setError('');
            }}
            ariaLabel="月度餐补预算"
          />
        </label>
        <label className="field">
          <span>月度保底</span>
          <MoneyInput
            value={minimum}
            onChange={(value) => {
              setMinimum(value);
              setError('');
            }}
            ariaLabel="月度保底"
          />
        </label>
        {rates && (
          <p className="muted" aria-live="polite">
            自由额度 {formatYuan(rates.freeAllowance)} · 日均正常 {formatYuan(rates.dailyNormal)} / 日均保底 {formatYuan(rates.dailyMinimum)}
          </p>
        )}
        {budgetCents !== null && minimumCents !== null && minimumCents >= budgetCents && (
          <p className="form-error" role="alert">月度保底必须小于月度预算</p>
        )}
        <label className="field">
          <span>起始日期</span>
          <input
            type="date"
            value={startDate}
            max={todayKey()}
            required
            onChange={(event) => {
              setStartDate(event.target.value);
              setError('');
            }}
            aria-label="起始日期"
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button--primary" type="submit">开始记账</button>
      </form>
      <p className="onboarding__hint muted">数据只保存在这台手机上。</p>
    </div>
  );
}
