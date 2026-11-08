import { useState } from 'react';
import { formatDisplayDate, formatMonthLabel, todayKey } from '../../domain/dates';
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

function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;
}

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const [planningMetric, setPlanningMetric] = useState<PlanningMetric>('net');
  const [showDetails, setShowDetails] = useState(true);
  const today = todayKey();
  const periods = buildMealTimeline(mealState, today).filter((period) => period.startDate <= today);
  const displayPeriods = [...periods].reverse();
  const planningRows = planningMonthlySeries(planningState, today, count);
  const planningDisplay = [...planningRows].reverse();
  const mealHasData = periods.some((period) => period.days.length > 0);
  const planningHasData =
    planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;
  const metric = METRIC_OPTIONS.find((option) => option.value === planningMetric)!;

  const chartData =
    ledger === 'meal'
      ? periods.map((period) => ({ label: shortDate(period.startDate), value: period.net }))
      : planningRows.map((row) => ({
          label: `${Number(row.month.slice(5))}月`,
          value: row[METRIC_FIELD[planningMetric]],
        }));

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

      {ledger === 'planning' && (
        <SegmentedControl options={METRIC_OPTIONS} value={planningMetric} onChange={setPlanningMetric} />
      )}

      {!hasData ? (
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示统计。" />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{ledger === 'meal' ? '每周期结余' : `每月${metric.label}`}</h2>
            <BarChart
              data={chartData}
              color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'}
              ariaLabel={ledger === 'meal' ? '餐补周期结余趋势' : `补回账月度${metric.label}趋势`}
              formatValue={formatCompactYuan}
            />
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
                      <strong>
                        {formatDisplayDate(period.startDate)} – {formatDisplayDate(period.endDate)}
                      </strong>
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
