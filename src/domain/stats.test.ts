import { describe, expect, it } from 'vitest';
import { mealMonthlySeries } from './stats';
import { planningMonthlySeries } from './stats';
import type { MealState } from './meal';
import type { PlanningState } from './planning';

const today = '2026-11-10';

const mealState: MealState = {
  settings: { dailyAllowance: 2000, startDate: '2026-10-01' },
  records: {
    '2026-10-05': { spent: 1500, allowance: 2000, updatedAt: '2026-10-05T00:00:00.000Z' },
    '2026-11-05': { spent: 2500, allowance: 2000, updatedAt: '2026-11-05T00:00:00.000Z' },
  },
};

const planningState: PlanningState = {
  events: [],
  spends: [{ id: 's1', eventId: 'e1', date: '2026-11-02', amount: 300000, createdAt: '2026-11-02T00:00:00.000Z' }],
  replenishes: [{ id: 'r1', eventId: 'e1', date: '2026-11-08', amount: 100000, createdAt: '2026-11-08T00:00:00.000Z' }],
  inflows: [{ id: 'i1', date: '2026-11-09', amount: 50000, createdAt: '2026-11-09T00:00:00.000Z' }],
};

describe('monthly series', () => {
  it('returns the last n meal months ending with the current month', () => {
    const series = mealMonthlySeries(mealState, today, 2);
    expect(series.map((row) => row.month)).toEqual(['2026-10', '2026-11']);
    expect(series[0].net).toBe(500);
    expect(series[1].net).toBe(-500);
    expect(series[1].endBalance).toBe(0);
  });

  it('returns the last n planning months with net and end balance', () => {
    const series = planningMonthlySeries(planningState, today, 2);
    expect(series.map((row) => row.month)).toEqual(['2026-10', '2026-11']);
    expect(series[0].net).toBe(0);
    expect(series[1].net).toBe(-150000);
    expect(series[1].endBalance).toBe(-150000);
  });
});
