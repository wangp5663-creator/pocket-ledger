import { useState } from 'react';
import { formatMonthLabel, todayKey } from '../../domain/dates';
import { formatSignedYuan, formatYuan } from '../../domain/money';
import { mealMonthlySeries, planningMonthlySeries } from '../../domain/stats';
import { useMeal } from '../../state/MealStore';
import { usePlanning } from '../../state/PlanningStore';
import { BarChart } from '../components/BarChart';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';

type Ledger = 'meal' | 'planning';

export function StatsPage() {
  const { state: mealState } = useMeal();
  const { state: planningState } = usePlanning();
  const [ledger, setLedger] = useState<Ledger>('meal');
  const [count, setCount] = useState(6);
  const today = todayKey();
  const mealRows = mealMonthlySeries(mealState, today, count);
  const planningRows = planningMonthlySeries(planningState, today, count);
  const chartData =
    ledger === 'meal'
      ? mealRows.map((row) => ({ label: row.month, value: row.net }))
      : planningRows.map((row) => ({ label: row.month, value: row.net }));
  const displayMealRows = [...mealRows].reverse();
  const displayPlanningRows = [...planningRows].reverse();
  const hasData =
    ledger === 'meal'
      ? Object.keys(mealState.records).length > 0
      : planningState.spends.length + planningState.replenishes.length + planningState.inflows.length > 0;

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
        <EmptyState title="还没有数据" hint="记录几笔后，这里会显示月度统计。" />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{ledger === 'meal' ? '每月结余' : '每月净变化'}</h2>
            <BarChart
              data={chartData}
              color={ledger === 'meal' ? 'var(--meal-primary)' : 'var(--planning-primary)'}
            />
          </section>

          <section className="card table-wrap">
            {ledger === 'meal' ? (
              <div className="table table--stats">
                <div className="table__row table__head">
                  <span>月份</span>
                  <span>天数</span>
                  <span>餐补额度</span>
                  <span>餐费</span>
                  <span>结余</span>
                  <span>累计</span>
                </div>
                {displayMealRows.map((row) => (
                  <div className="table__row" key={row.month}>
                    <span>{formatMonthLabel(row.month)}</span>
                    <span>{row.daysRecorded}</span>
                    <span>{formatYuan(row.allowanceTotal)}</span>
                    <span>{formatYuan(row.spentTotal)}</span>
                    <span className={row.net >= 0 ? 'positive' : 'negative'}>{formatSignedYuan(row.net)}</span>
                    <span>{formatYuan(row.endBalance)}</span>
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
                {displayPlanningRows.map((row) => (
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

          <button type="button" className="button button--secondary" onClick={() => setCount((current) => current + 6)}>
            显示更早的月份
          </button>
        </>
      )}
    </div>
  );
}
