import { describe, expect, it } from 'vitest';
import {
  buildMealRows,
  computeMealBalance,
  dailyBalance,
  defaultMealState,
  mealMonthSummary,
  missingDates,
  type MealRecord,
  type MealState,
} from './meal';

function record(spent: number, allowance = 2000): MealRecord {
  return { spent, allowance, updatedAt: '2026-11-01T00:00:00.000Z' };
}

const settings = { dailyAllowance: 2000, startDate: '2026-11-01' };

describe('meal balance', () => {
  it('sums daily balances and allows overspend', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-11-01': record(1500),
        '2026-11-02': record(2500),
        '2026-11-03': record(2000),
      },
    };
    expect(computeMealBalance(state)).toBe(0);
    expect(dailyBalance(record(2500))).toBe(-500);
  });

  it('keeps allowance snapshots instead of current settings', () => {
    const state: MealState = {
      settings: { dailyAllowance: 2500, startDate: '2026-11-01' },
      records: { '2026-11-01': record(1000, 2000) },
    };
    expect(computeMealBalance(state)).toBe(1000);
  });

  it('defaults to 20 yuan and an empty start date', () => {
    expect(defaultMealState()).toEqual({
      settings: { dailyAllowance: 2000, startDate: '' },
      records: {},
    });
  });
});

describe('missing dates', () => {
  it('lists unrecorded dates from start date to yesterday', () => {
    const state: MealState = {
      settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
      records: { '2026-11-02': record(2000) },
    };
    expect(missingDates(state, '2026-11-05')).toEqual(['2026-11-01', '2026-11-03', '2026-11-04']);
    expect(missingDates(state, '2026-11-01')).toEqual([]);
  });

  it('returns empty before the start date', () => {
    const state: MealState = { settings: { dailyAllowance: 2000, startDate: '' }, records: {} };
    expect(missingDates(state, '2026-11-05')).toEqual([]);
  });
});

describe('meal rows', () => {
  it('sorts by date and accumulates balance', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-11-03': record(2000),
        '2026-11-01': record(1500),
        '2026-11-02': record(2500),
      },
    };
    const rows = buildMealRows(state);
    expect(rows.map((row) => row.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(rows.map((row) => row.cumulative)).toEqual([500, 0, 0]);
  });
});

describe('meal month summary', () => {
  it('aggregates a month and cumulative end balance', () => {
    const state: MealState = {
      settings,
      records: {
        '2026-10-31': record(1000),
        '2026-11-01': record(1000),
        '2026-11-02': record(2500),
        '2026-11-03': record(1500),
      },
    };
    const summary = mealMonthSummary(state, '2026-11', '2026-11-10');
    expect(summary.daysRecorded).toBe(3);
    expect(summary.allowanceTotal).toBe(6000);
    expect(summary.spentTotal).toBe(5000);
    expect(summary.net).toBe(1000);
    expect(summary.endBalance).toBe(2000);
  });
});
