import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { MoneyInput } from '../components/MoneyInput';

export function Onboarding() {
  const { updateSettings } = useMeal();
  const [allowance, setAllowance] = useState('20');
  const [startDate, setStartDate] = useState(todayKey());
  const [error, setError] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(allowance);
    if (cents === null || cents <= 0) {
      setError('请输入大于 0 的每日餐补金额');
      return;
    }
    const message = updateSettings({ dailyAllowance: cents, startDate });
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
        <p className="muted">先设置你的每日餐补和起始日期。</p>
      </div>
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>每日餐补</span>
          <MoneyInput value={allowance} onChange={setAllowance} ariaLabel="每日餐补金额" />
        </label>
        <label className="field">
          <span>起始日期</span>
          <input type="date" value={startDate} max={todayKey()} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button button--primary" type="submit">
          开始记账
        </button>
      </form>
      <p className="onboarding__hint muted">数据只保存在这台手机上。</p>
    </div>
  );
}
