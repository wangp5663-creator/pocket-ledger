import { useState } from 'react';
import {
  formatDisplayDate,
  formatMonthLabel,
  formatPeriodRange,
  formatPeriodShort,
  todayKey,
} from '../../domain/dates';
import { buildMealTimeline } from '../../domain/mealV2';
import { formatCompactYuan, formatSignedYuan, formatYuan } from '../../domain/money';
import type { PlanningMonthSummary } from '../../domain/planning';
import { planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';
type PlanningMetric = 'net' | 'spend' | 'replenish' | 'inflow';
type MealMetric = 'periodNet' | 'dailySpend' | 'dailyBalance';

const MEAL_METRIC_OPTIONS: Array<{ value: MealMetric; label: string }> = [
  { value: 'periodNet', label: '每周期结余' },
  { value: 'dailySpend', label: '每日花费' },
  { value: 'dailyBalance', label: '当日结余' },
];

const METRIC_OPTIONS: Array<{ value: PlanningMetric; label: string }> = [
  { value: 'net', label: '净变化' },
  { value: 'spend', label: '支出' },
  { value: 'replenish', label: '补回' },
  { value: 'inflow', label: '汇入' },
];

const METRIC_FIELD: Record<
  PlanningMetric,
  keyof Pick<PlanningMonthSummary, 'net' | 'spends' | 'replenishes' | 'inflows'>
> = {
  net: 'net',
  spend: 'spends',
  replenish: 'replenishes',
  inflow: 'inflows',
};

function shortDay(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;
}

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const [planningMetric, setPlanningMetric] = useState<PlanningMetric>('net');
  const [mealMetric, setMealMetric] = useState<MealMetric>('periodNet');
  const [showDetails, setShowDetails] = useState(true);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const today = todayKey();
  const periods = buildMealTimeline(mealState, today).filter((period) => period.startDate <= today);
  const displayPeriods = [...periods].reverse();
  const selectedPeriod =
    periods.find((period) => period.restore.id === selectedPeriodId) ?? periods[periods.length - 1];
  const selectedDays = selectedPeriod?.days ?? [];
  const planningRows = planningMonthlySeries(planningState, today, count);
  const planningDisplay = [...planningRows].reverse();
  const mealHasData = periods.some((period) => period.days.length > 0);
  const planningHasData =
    planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;
  const metric = METRIC_OPTIONS.find((option) => option.value === planningMetric)!;
  const mealMetricOption = MEAL_METRIC_OPTIONS.find((option) => option.value === mealMetric)!;

  const mealDailyData = selectedDays.map((day) => ({
    label: shortDay(day.date),
    value: mealMetric === 'dailySpend' ? day.spent : day.dailyBalance,
  }));

  const chartData =
    ledger === 'meal'
      ? mealMetric === 'periodNet'
        ? periods.map((period) => ({
            label: formatPeriodShort(period.startDate, period.endDate),
            value: period.net,
          }))
        : mealDailyData
      : planningRows.map((row) => ({
          label: `${Number(row.month.slice(5))}月`,
          value: row[METRIC_FIELD[planningMetric]],
        }));

  const chartTitle = ledger === 'meal' ? mealMetricOption.label : `每月${metric.label}`;
  const chartAria = ledger === 'meal' ? `餐补${mealMetricOption.label}趋势` : `补回账月度${metric.label}趋势`;
  const chartSubtitle =
    ledger === 'meal' && mealMetric !== 'periodNet' && selectedPeriod
      ? formatPeriodRange(selectedPeriod.startDate, selectedPeriod.endDate)
      : null;

  const hasData = ledger === 'meal' ? mealHasData : planningHasData;

  return (
    <div className="page">
      <h1>统计</h1>
      <SegmentedControl
        options={[
          { value: 'meal', label: '餐补' },
          { value: 'planning', label: '补回账' },
        ]}
        value={ledger}
        onChange={setLedger}
      />

      {ledger === 'meal' && (
        <SegmentedControl options={MEAL_METRIC_OPTIONS} value={mealMetric} onChange={setMealMetric} />
      )}

      {ledger === 'planning' && (
        <SegmentedControl options={METRIC_OPTIONS} value={planningMetric} onChange={setPlanningMetric} />
      )}

      {!hasData ? (
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示统计。" />
      ) : (
        <>
          {ledger === 'meal' && mealMetric !== 'periodNet' && (
            <div className="chart-period">
              <label className="field">
                <span>查看周期</span>
                <select
                  value={selectedPeriod?.restore.id ?? ''}
                  onChange={(event) => setSelectedPeriodId(event.target.value)}
                  aria-label="查看周期"
                >
                  {[...periods].reverse().map((period) => (
                    <option key={period.restore.id} value={period.restore.id}>
                      {formatPeriodRange(period.startDate, period.endDate)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <section className="card">
            <h2 className="card-title">{chartTitle}</h2>
            {chartSubtitle && (
              <p className="muted chart-subtitle">
                {chartSubtitle}
                {mealMetric !== 'periodNet' && selectedDays.length > 7 ? ' · 左右滑动查看' : ''}
              </p>
            )}
            {chartData.length === 0 ? (
              <p className="muted">这个周期还没有记录。</p>
            ) : (
              <BarChart
                data={chartData}
                color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'}
                ariaLabel={chartAria}
                formatValue={formatCompactYuan}
                scroll={ledger === 'meal' && mealMetric !== 'periodNet'}
                scrollKey={
                  ledger === 'meal' && mealMetric !== 'periodNet'
                    ? `${mealMetric}-${selectedPeriod?.restore.id ?? ''}`
                    : undefined
                }
              />
            )}
          </section>

          <div className="detail-toggle">
            <button type="button" className="text-button" onClick={() => setShowDetails((value) => !value)}>
              {showDetails ? '隐藏明细' : '显示明细'}
            </button>
          </div>

          {showDetails && (
            <>
          <section className={ledger === 'meal' ? 'card' : 'card table-wrap'}>
            {ledger === 'meal' ? (
              <div className="period-stats">
                {displayPeriods.map((period) => (
                  <div className="period-stat" key={period.restore.id}>
                    <div className="period-stat__head">
                      <strong>{formatPeriodRange(period.startDate, period.endDate)}</strong>
                      {period.startDate <= today && period.endDate >= today && (
                        <span className="mode-badge">进行中</span>
                      )}
                    </div>
                    <div className="period-stat__grid">
                      <div>
                        <span className="muted">每日正常额度</span>
                        <strong>{formatYuan(period.restore.dailyNormal)}</strong>
                      </div>
                      <div>
                        <span className="muted">保底切换日</span>
                        <strong>{period.switchDate ? formatDisplayDate(period.switchDate) : '—'}</strong>
                      </div>
                      <div>
                        <span className="muted">花费</span>
                        <strong>{formatYuan(period.totalSpent)}</strong>
                      </div>
                      <div>
                        <span className="muted">期末余额</span>
                        <strong className={period.endingBalance >= 0 ? 'positive' : 'negative'}>
                          {formatSignedYuan(period.endingBalance)}
                        </strong>
                      </div>
                      <div>
                        <span className="muted">结转</span>
                        <strong>{period.carry > 0 ? formatYuan(period.carry) : '已清零'}</strong>
                      </div>
                    </div>
                    <div className="period-stat__days">
                      <div className="period-stat__day period-stat__day--head">
                        <span>日期</span>
                        <span>花费</span>
                        <span>当日结余</span>
                      </div>
                      {period.days.length === 0 ? (
                        <p className="muted">没有记录</p>
                      ) : (
                        [...period.days].reverse().map((day) => (
                          <div className="period-stat__day" key={day.date}>
                            <span>{formatDisplayDate(day.date)}</span>
                            <span>{formatYuan(day.spent)}</span>
                            <span className={day.dailyBalance >= 0 ? 'positive' : 'negative'}>
                              {formatSignedYuan(day.dailyBalance)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>月份</span>
                  <span>支出</span>
                  <span>补回</span>
                  <span>汇入</span>
                  <span>净变化</span>
                  <span>余额</span>
                </div>
                {planningDisplay.map((row) => (
                  <div className="table__row" key={row.month}>
                    <span>{formatMonthLabel(row.month)}</span>
                    <span>{formatYuan(row.spends)}</span>
                    <span>{formatYuan(row.replenishes)}</span>
                    <span>{formatYuan(row.inflows)}</span>
                    <span className={row.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(row.net)}</span>
                    <span>{formatYuan(row.endBalance)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {ledger === 'planning' && (
            <p className="muted table-hint">左右滑动查看完整月份数据</p>
          )}

          {ledger === 'planning' && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setCount((current) => current + 6)}
            >
              显示更早的月份
            </button>
          )}
            </>
          )}
        </>
      )}
    </div>
  );
}
