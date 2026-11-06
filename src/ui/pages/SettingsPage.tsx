import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { buildMealTimeline, currentMealStatus, deriveRates } from '../../domain/mealV2';
import { centsToYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyInput } from '../components/MoneyInput';
import { PeriodCalendar } from '../components/PeriodCalendar';
import { Sheet } from '../components/Sheet';

export function SettingsPage() {
  const { state, updateSettings, restoreNow, customizePeriod, clearRecords } = useMeal();
  const { clearAll } = usePlanning();
  const today = todayKey();
  const status = currentMealStatus(state, today);
  const rates = deriveRates(state.settings, status.startDate || today);
  const futurePeriods = buildMealTimeline(state, today).filter((period) => period.startDate > today);

  const [budget, setBudget] = useState(centsToYuan(state.settings.monthlyBudget));
  const [minimum, setMinimum] = useState(centsToYuan(state.settings.monthlyMinimum));
  const [cycleStartDay, setCycleStartDay] = useState(String(state.settings.cycleStartDay ?? 1));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [clearMealOpen, setClearMealOpen] = useState(false);
  const [clearPlanOpen, setClearPlanOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const alreadyRestoredToday = state.restores.some((restore) => restore.date === today);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const budgetCents = parseYuanToCents(budget);
    const minimumCents = parseYuanToCents(minimum);
    const cycleDay = Number(cycleStartDay);
    if (budgetCents === null || minimumCents === null) {
      setError('请输入有效金额');
      setMessage('');
      return;
    }
    if (!Number.isInteger(cycleDay) || cycleDay < 1 || cycleDay > 31) {
      setError('周期起始日必须是 1-31');
      setMessage('');
      return;
    }
    const result = updateSettings({
      monthlyBudget: budgetCents,
      monthlyMinimum: minimumCents,
      startDate: state.settings.startDate,
      cycleStartDay: cycleDay,
    });
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('设置已保存，下次恢复时生效');
  };

  const manualRestore = () => {
    const result = restoreNow();
    if (result) {
      setError(result);
      setMessage('');
      return;
    }
    setError('');
    setMessage('已恢复正常额度');
  };

  return (
    <div className="page">
      <h1>设置</h1>

      <section className="card">
        <h2 className="card-title">餐补设置</h2>
        <form className="form" onSubmit={save}>
          <label className="field">
            <span>月度餐补预算</span>
            <MoneyInput value={budget} onChange={setBudget} ariaLabel="月度餐补预算" />
          </label>
          <label className="field">
            <span>月度保底</span>
            <MoneyInput value={minimum} onChange={setMinimum} ariaLabel="月度保底" />
          </label>
          <label className="field">
            <span>周期起始日（每月几号开始）</span>
            <input
              type="number"
              min={1}
              max={31}
              value={cycleStartDay}
              onChange={(event) => setCycleStartDay(event.target.value)}
              aria-label="周期起始日"
            />
          </label>
          <p className="muted">
            整月自由额度 {formatYuan(rates.freeAllowance)} · 日均正常 {formatYuan(rates.dailyNormal)} / 日均保底 {formatYuan(rates.dailyMinimum)}
          </p>
          <p className="muted">周期默认从每月起始日到下个月起始日前一天；修改后下次恢复生效。</p>
          <p className="muted">起始日期 {state.settings.startDate ? formatDisplayDate(state.settings.startDate) : '未设置'}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="positive" role="status" aria-live="polite">{message}</p>}
          <button className="button button--primary" type="submit">保存设置</button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title">当前周期</h2>
        <div className="summary-grid">
          <div><span className="muted">开始日期</span><strong>{formatDisplayDate(status.startDate)}</strong></div>
          <div><span className="muted">结束日期</span><strong>{formatDisplayDate(status.endDate)}</strong></div>
          <div><span className="muted">开始额度</span><strong>{formatYuan(status.dailyNormal)}/天</strong></div>
          <div><span className="muted">当前阶段</span><strong>{status.switchDate ? `保底 ${formatYuan(status.dailyMinimum)}` : `正常 ${formatYuan(status.dailyNormal)}`}</strong></div>
          <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
        </div>
        <button
          type="button"
          className="button button--secondary"
          disabled={alreadyRestoredToday}
          onClick={() => setRestoreOpen(true)}
        >
          {alreadyRestoredToday ? '今天已经恢复过' : '立即恢复正常额度'}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            setCalendarError('');
            setCalendarOpen(true);
          }}
        >
          自定义周期（含历史）
        </button>
        <p className="muted">日历可调整历史、当前和未来周期；恢复后负数清零、正数带入；手动恢复每天最多一次。</p>
      </section>

      {calendarOpen && (
        <Sheet open title="自定义周期" onClose={() => setCalendarOpen(false)}>
          {calendarError && (
            <p className="form-error" role="alert">
              {calendarError}
            </p>
          )}
          <PeriodCalendar
            initialStart={status.startDate}
            initialEnd={status.endDate}
            minDate={state.settings.startDate}
            today={today}
            onCancel={() => setCalendarOpen(false)}
            onConfirm={(startDate, endDate) => {
              const result = customizePeriod(startDate, endDate);
              if (result) {
                setCalendarError(result);
                return;
              }
              setCalendarError('');
              setError('');
              setMessage('周期已更新');
              setCalendarOpen(false);
            }}
          />
        </Sheet>
      )}

      {futurePeriods.length > 0 && (
        <section className="card">
          <h2 className="card-title">未来周期</h2>
          {futurePeriods.map((period) => (
            <div className="period-meta" key={period.restore.id}>
              {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)} · {formatYuan(period.restore.dailyNormal)}/天
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">数据</h2>
        <p className="muted">数据只保存在本机浏览器中，清除浏览器数据会丢失记录。</p>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearPlanOpen(true)}>
          清空规划账数据
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">关于</h2>
        <p className="muted">小账本 v0.2.0 · PWA · 数据版本 v2</p>
      </section>

      {restoreOpen && (
        <ConfirmDialog
          open
          title="立即恢复正常额度？"
          message="负数将清零、正数将带入新周期；手动恢复每天最多一次。"
          confirmLabel="确认恢复"
          onCancel={() => setRestoreOpen(false)}
          onConfirm={() => {
            setRestoreOpen(false);
            manualRestore();
          }}
        />
      )}

      {clearMealOpen && (
        <ConfirmDialog
          open
          title="清空餐补数据？"
          message="将删除所有餐补记录与周期，并把起始日期重置为今天；预算和保底保留。"
          confirmLabel="确认清空"
          onCancel={() => setClearMealOpen(false)}
          onConfirm={() => {
            clearRecords();
            setClearMealOpen(false);
            setError('');
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
