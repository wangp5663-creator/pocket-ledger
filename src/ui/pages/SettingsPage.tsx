import { useState } from 'react';
import type { FormEvent } from 'react';
import { todayKey } from '../../domain/dates';
import { centsToYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyInput } from '../components/MoneyInput';

export function SettingsPage() {
  const { state, updateSettings, clearRecords } = useMeal();
  const { clearAll } = usePlanning();
  const [allowance, setAllowance] = useState(centsToYuan(state.settings.dailyAllowance));
  const [startDate, setStartDate] = useState(state.settings.startDate);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearMealOpen, setClearMealOpen] = useState(false);
  const [clearPlanOpen, setClearPlanOpen] = useState(false);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const cents = parseYuanToCents(allowance);
    if (cents === null || cents <= 0) {
      setError('每日餐补必须是大于 0 的有效金额');
      setMessage('');
      return;
    }
    const result = updateSettings({ dailyAllowance: cents, startDate });
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('设置已保存');
  };

  return (
    <div className="page">
      <h1>设置</h1>

      <section className="card">
        <h2 className="card-title">餐补设置</h2>
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>每日餐补</span>
            <MoneyInput value={allowance} onChange={setAllowance} ariaLabel="每日餐补金额" />
          </label>
          <label className="field">
            <span>起始日期（只能提前）</span>
            <input
              type="date"
              value={startDate}
              max={todayKey()}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && <p className="positive">{message}</p>}
          <button className="button button--primary" type="submit">
            保存设置
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">数据</h2>
        <p className="muted">数据只保存在本机浏览器中，清除浏览器数据会丢失记录。</p>
        <button type="button" className="button button--ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--ghost" onClick={() => setClearPlanOpen(true)}>
          清空规划账数据
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">关于</h2>
        <p className="muted">小账本 v0.1.0 · PWA · 本地存储</p>
      </section>

      {clearMealOpen && (
        <ConfirmDialog
          open
          title="清空餐补数据？"
          message="将删除所有餐补记录，并把起始日期重置为今天；每日餐补金额保留。"
          confirmLabel="确认清空"
          onCancel={() => setClearMealOpen(false)}
          onConfirm={() => {
            clearRecords();
            setStartDate(todayKey());
            setError('');
            setClearMealOpen(false);
            setMessage('餐补数据已清空');
          }}
        />
      )}

      {clearPlanOpen && (
        <ConfirmDialog
          open
          title="清空规划账数据？"
          message="将删除所有事项、支出、补回和汇入记录，且无法恢复。"
          confirmLabel="确认清空"
          onCancel={() => setClearPlanOpen(false)}
          onConfirm={() => {
            clearAll();
            setClearPlanOpen(false);
            setError('');
            setMessage('规划账数据已清空');
          }}
        />
      )}
    </div>
  );
}
