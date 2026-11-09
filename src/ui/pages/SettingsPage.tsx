import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { buildMealTimeline, currentMealStatus, deriveRates } from '../../domain/mealV2';
import { centsToYuan, formatYuan, parseYuanToCents } from '../../domain/money';
import { useMeal } from '../../state/MealStore';
import { usePlan } from '../../state/PlanStore';
import { usePlanning } from '../../state/PlanningStore';
import {
  applyFontScale,
  FONT_SCALE_LABELS,
  FONT_SCALES,
  loadFontScale,
  saveFontScale,
  type FontScaleValue,
} from '../../state/uiPreferences';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MoneyInput } from '../components/MoneyInput';
import { PeriodCalendar } from '../components/PeriodCalendar';
import { Sheet } from '../components/Sheet';

export function SettingsPage() {
  const { state, updateSettings, restoreNow, customizePeriod, clearRecords } = useMeal();
  const { clearAll: clearLedger } = usePlanning();
  const { clearAll: clearPlanItems } = usePlan();
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
  const [clearItemsOpen, setClearItemsOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScaleValue>(() => loadFontScale());
  const alreadyRestoredToday = state.restores.some((restore) => restore.date === today);

  const changeFontScale = (value: FontScaleValue) => {
    setFontScale(value);
    saveFontScale(value);
    applyFontScale(value);
  };

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
    setMessage('周期已恢复');
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
          <div className="settings-notes">
            <p className="muted">
              整月自由额度 {formatYuan(rates.freeAllowance)} · 正常 {formatYuan(rates.dailyNormal)}/天 · 保底{' '}
              {formatYuan(rates.dailyMinimum)}/天
            </p>
            <p className="muted">周期默认从每月起始日到下个月起始日前一天；修改后下次恢复生效。</p>
            <p className="muted">
              开始日期 {state.settings.startDate ? formatDisplayDate(state.settings.startDate) : '未设置'}
            </p>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="positive" role="status" aria-live="polite">{message}</p>}
          <button className="button button--primary" type="submit">保存设置</button>
        </form>
      </section>

      <section className="card settings-cycle">
        <h2 className="card-title">当前周期</h2>
        <div className="summary-grid">
          <div><span className="muted">开始日期</span><strong>{formatDisplayDate(status.startDate)}</strong></div>
          <div><span className="muted">结束日期</span><strong>{formatDisplayDate(status.endDate)}</strong></div>
          <div><span className="muted">每日正常额度</span><strong>{formatYuan(status.dailyNormal)}/天</strong></div>
          <div>
            <span className="muted">当前阶段</span>
            <strong>
              {status.switchDate
                ? `保底阶段 ${formatYuan(status.dailyMinimum)}/天`
                : `正常阶段 ${formatYuan(status.dailyNormal)}/天`}
            </strong>
          </div>
          <div><span className="muted">自由额度</span><strong>{status.mode === 'normal' ? formatYuan(status.freeRemaining) : '无'}</strong></div>
        </div>
        <button
          type="button"
          className="button button--secondary"
          disabled={alreadyRestoredToday}
          onClick={() => setRestoreOpen(true)}
        >
          {alreadyRestoredToday ? '今天已经恢复过' : '立即恢复周期'}
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
        <p className="muted">
          日历可调整历史、当前和未来周期，也可以选到开始日期之前（开始日期会随之前移）；缺记的日子可到「补记」补上。恢复后负结余清零、正结余结转到新周期；手动恢复每天最多一次。
        </p>
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
        <p className="muted">数据只保存在本机，清除应用数据会丢失记录。</p>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearMealOpen(true)}>
          清空餐补数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearPlanOpen(true)}>
          清空补回账数据
        </button>
        <button type="button" className="button button--danger-ghost" onClick={() => setClearItemsOpen(true)}>
          清空用款计划
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">显示</h2>
        <p className="muted">调整后立即生效，并保存在本机。</p>
        <div className="font-scale-options" role="group" aria-label="字体大小">
          {FONT_SCALES.map((value) => (
            <button
              key={value}
              type="button"
              className={`font-scale-option${fontScale === value ? ' is-active' : ''}`}
              aria-pressed={fontScale === value}
              onClick={() => changeFontScale(value)}
            >
              {FONT_SCALE_LABELS[value]}
            </button>
          ))}
        </div>
        <p className="muted">
          字体跟随系统默认字体；华为主题商店的字体属于系统主题，网页内核（WebView）无法读取，所以这里只调整字号。
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">关于</h2>
        <p className="muted">小账本 v{__APP_VERSION__}</p>
      </section>

      {restoreOpen && (
        <ConfirmDialog
          open
          title="立即恢复周期？"
          message="负结余将清零、正结余将结转到新周期；手动恢复每天最多一次。"
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
          message="将删除所有餐补记录与周期，并把开始日期重置为今天；预算和保底保留。"
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
          title="清空补回账数据？"
          message="将删除所有事项、支出、补回和汇入记录，且无法恢复。"
          confirmLabel="确认清空"
          onCancel={() => setClearPlanOpen(false)}
          onConfirm={() => {
            clearLedger();
            setClearPlanOpen(false);
            setError('');
            setMessage('补回账数据已清空');
          }}
        />
      )}

      {clearItemsOpen && (
        <ConfirmDialog
          open
          title="清空用款计划？"
          message="将删除所有用款计划条目，且无法恢复。"
          confirmLabel="确认清空"
          onCancel={() => setClearItemsOpen(false)}
          onConfirm={() => {
            clearPlanItems();
            setClearItemsOpen(false);
            setError('');
            setMessage('用款计划已清空');
          }}
        />
      )}
    </div>
  );
}
