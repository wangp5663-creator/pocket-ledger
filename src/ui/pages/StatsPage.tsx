import { useState } from 'react';
import { formatDisplayDate, todayKey } from '../../domain/dates';
import { buildMealTimeline } from '../../domain/mealV2';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';

function shortDate(dateKey: string): string {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8))}`;
}

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const today = todayKey();
  const periods = buildMealTimeline(mealState, today);
  const displayPeriods = [...periods].reverse();
  const planningRows = planningMonthlySeries(planningState, today, count);
  const planningDisplay = [...planningRows].reverse();
  const mealHasData = periods.some((period) => period.days.length > 0);
  const planningHasData =
    planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;

  const chartData =
    ledger === 'meal'
      ? periods.map((period) => ({ label: shortDate(period.startDate), value: period.net }))
      : planningRows.map((row) => ({ label: row.month, value: row.net }));

  const hasData = ledger === 'meal' ? mealHasData : planningHasData;

  return (
    <div className="page">
      <h1>统计</h1>
      <SegmentedControl
        options={[
          { value: 'meal', label: '餐补' },
          { value: 'planning', label: '规划账' },
        ]}
        value={ledger}
        onChange={setLedger}
      />

      {!hasData ? (
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示统计。" />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{ledger === 'meal' ? '每期结余' : '每月净变化'}</h2>
            <BarChart data={chartData} color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'} />
          </section>

          <section className="card table-wrap">
            {ledger === 'meal' ? (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>周期</span><span>开始额度</span><span>15切换</span><span>花费</span><span>结束</span><span>结转</span>
                </div>
                {displayPeriods.map((period) => (
                  <div className="table__row" key={period.restore.id}>
                    <span>{formatDisplayDate(period.startDate)}–{formatDisplayDate(period.endDate)}</span>
                    <span>{formatYuan(period.restore.dailyNormal)}</span>
                    <span>{period.switchDate ? formatDisplayDate(period.switchDate) : '—'}</span>
                    <span>{formatYuan(period.totalSpent)}</span>
                    <span className={period.endingBalance >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(period.endingBalance)}</span>
                    <span>{period.carry > 0 ? formatYuan(period.carry) : '已清零'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>月份</span><span>支出</span><span>补回</span><span>汇入</span><span>净变化</span><span>余额</span>
                </div>
                {planningDisplay.map((row) => (
                  <div className="table__row" key={row.month}>
                    <span>{row.month}</span>
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
            <button type="button" className="button button--secondary" onClick={() => setCount((current) => current + 6)}>
              显示更早的月份
            </button>
          )}
        </>
      )}
    </div>
  );
}
