import { describe, expect, it } from 'vitest';
import {
  buildMealTimeline,
  createRestoreEvent,
  currentMealStatus,
  defaultMealStateV2,
  deriveRates,
  missingMealDates,
  normalizeMealState,
  removeMealRecord,
  restoreMealNow,
  upsertMealRecord,
  validateMealSettings,
  type MealStateV2,
} from './mealV2';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '2026-11-01' };

describe('rates and defaults', () => {
  it('derives daily rates and free allowance', () => {
    expect(deriveRates(settings)).toEqual({
      dailyNormal: 2000,
      dailyMinimum: 1500,
      freeAllowance: 15000,
    });
  });

  it('defaults to 600 / 450 / empty start date', () => {
    expect(defaultMealStateV2()).toEqual({
      settings: { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '' },
      records: {},
      restores: [],
    });
  });

  it('validates settings', () => {
    expect(validateMealSettings(settings)).toBeNull();
    expect(validateMealSettings({ ...settings, monthlyBudget: 30000 })).toBe('月度保底必须小于月度预算');
    expect(validateMealSettings({ ...settings, monthlyMinimum: -1 })).toBe('月度保底不能为负数');
    expect(validateMealSettings({ ...settings, startDate: '' })).toBe('请选择起始日期');
  });
});

describe('restore event snapshot', () => {
  it('snapshots rates and clamps opening balance', () => {
    const event = createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z', -50);
    expect(event).toMatchObject({
      date: '2026-11-01',
      openingBalance: 0,
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      freeAllowance: 15000,
      dailyNormal: 2000,
      dailyMinimum: 1500,
    });
    expect(event.id).toBeTruthy();
  });
});

describe('missing dates', () => {
  it('lists unrecorded dates from start date to yesterday', () => {
    const state: MealStateV2 = {
      settings,
      records: { '2026-11-02': { spent: 2000, updatedAt: '2026-11-02T00:00:00.000Z' } },
      restores: [],
    };
    expect(missingMealDates(state, '2026-11-05')).toEqual(['2026-11-01', '2026-11-03', '2026-11-04']);
  });
});

describe('record helpers', () => {
  const base: MealStateV2 = { settings, records: {}, restores: [] };

  it('adds and updates records without storing allowance', () => {
    const next = upsertMealRecord(base, '2026-11-02', 1500, '午饭', '2026-11-02T12:00:00.000Z');
    expect(next.records['2026-11-02']).toEqual({
      spent: 1500,
      note: '午饭',
      updatedAt: '2026-11-02T12:00:00.000Z',
    });
  });

  it('removes records immutably', () => {
    const withRecord = upsertMealRecord(base, '2026-11-02', 1500, '', '2026-11-02T12:00:00.000Z');
    const next = removeMealRecord(withRecord, '2026-11-02');
    expect(next.records).toEqual({});
    expect(withRecord.records['2026-11-02']).toBeDefined();
  });
});

const baseState: MealStateV2 = {
  settings,
  records: {},
  restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
};

function withRecords(records: MealStateV2['records']): MealStateV2 {
  return { ...baseState, records };
}

describe('meal timeline', () => {
  it('keeps 20 yuan per day and accumulates balance before threshold', () => {
    const state = withRecords({
      '2026-11-01': { spent: 2500, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 1500, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const periods = buildMealTimeline(state, '2026-11-10');
    expect(periods).toHaveLength(1);
    expect(periods[0].openingBalance).toBe(0);
    expect(periods[0].days.map((day) => day.allowance)).toEqual([2000, 2000]);
    expect(periods[0].endingBalance).toBe(0);
    expect(periods[0].switchDate).toBeUndefined();
  });

  it('switches after the triggering day and rebases by plus free allowance', () => {
    const state = withRecords({
      '2026-11-01': { spent: 17000, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 2000, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const periods = buildMealTimeline(state, '2026-11-10');
    const days = periods[0].days;
    expect(days[0].allowance).toBe(2000);
    expect(days[0].switchedToMinimum).toBe(true);
    expect(days[0].balanceAfter).toBe(0); // -15000 + 15000
    expect(periods[0].switchDate).toBe('2026-11-01');
    expect(days[1].allowance).toBe(1500);
    expect(days[1].balanceAfter).toBe(-500);
  });

  it('carries positive balance into the next period and clears negative', () => {
    const state: MealStateV2 = {
      settings,
      records: {
        '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' },
        '2026-12-02': { spent: 3500, updatedAt: '2026-12-02T00:00:00.000Z' },
      },
      restores: [
        createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z'),
        createRestoreEvent(settings, '2026-12-01', '2026-12-01T00:00:00.000Z'),
      ],
    };
    const periods = buildMealTimeline(state, '2026-12-10');
    expect(periods[0].endingBalance).toBe(1000);
    expect(periods[1].openingBalance).toBe(1000);
    expect(periods[1].endingBalance).toBe(-500);
  });

  it('reports current status and free quota remaining', () => {
    const state = withRecords({
      '2026-11-01': { spent: 17000, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const status = currentMealStatus(state, '2026-11-10');
    expect(status.mode).toBe('minimum');
    expect(status.balance).toBe(500);
    expect(status.freeRemaining).toBe(0);
    expect(status.distanceToMinimum).toBe(0);
    expect(status.dailyAllowance).toBe(1500);
    expect(status.hasRecordToday).toBe(false);
  });

  it('reports normal-mode free quota and distance', () => {
    const state = withRecords({
      '2026-11-01': { spent: 1000, updatedAt: '2026-11-01T00:00:00.000Z' },
    });
    const status = currentMealStatus(state, '2026-11-10');
    expect(status.mode).toBe('normal');
    expect(status.balance).toBe(1000);
    expect(status.freeRemaining).toBe(15000);
    expect(status.distanceToMinimum).toBe(16000);
  });

  it('clears a negative period balance at the next restore', () => {
    const state: MealStateV2 = {
      settings,
      records: {
        '2026-11-02': { spent: 12000, updatedAt: '2026-11-02T00:00:00.000Z' },
        '2026-12-02': { spent: 1000, updatedAt: '2026-12-02T00:00:00.000Z' },
      },
      restores: [
        createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z'),
        createRestoreEvent(settings, '2026-12-01', '2026-12-01T00:00:00.000Z'),
      ],
    };
    const periods = buildMealTimeline(state, '2026-12-10');
    expect(periods[0].endingBalance).toBe(-10000);
    expect(periods[1].openingBalance).toBe(0);
    expect(periods[1].endingBalance).toBe(1000);
  });

  it('counts the free allowance in a switched period total allowance', () => {
    const state = withRecords({
      '2026-11-01': { spent: 17000, updatedAt: '2026-11-01T00:00:00.000Z' },
      '2026-11-02': { spent: 2000, updatedAt: '2026-11-02T00:00:00.000Z' },
    });
    const period = buildMealTimeline(state, '2026-11-10')[0];
    expect(period.totalAllowance).toBe(18500); // 2000 + 15000 rebase + 1500
    expect(period.totalSpent).toBe(19000);
    expect(period.net).toBe(period.totalAllowance - period.totalSpent);
    expect(period.endingBalance).toBe(-500);
  });
});

describe('restore normalization', () => {
  it('creates the first restore and fills missed month starts', () => {
    const state: MealStateV2 = { settings, records: {}, restores: [] };
    const next = normalizeMealState(state, '2027-02-10');
    expect(next.restores.map((event) => event.date)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
  });

  it('does not add duplicate auto restores', () => {
    const state: MealStateV2 = {
      settings,
      records: {},
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const next = normalizeMealState(state, '2026-11-20');
    expect(next.restores).toHaveLength(1);
  });
});

describe('restore carry snapshots', () => {
  it('snapshots positive carry into auto restores', () => {
    const state: MealStateV2 = {
      settings,
      records: { '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' } },
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const next = normalizeMealState(state, '2026-12-10');
    expect(next.restores.find((event) => event.date === '2026-12-01')?.openingBalance).toBe(1000);
  });

  it('snapshots positive carry into manual restores', () => {
    const state: MealStateV2 = {
      settings,
      records: { '2026-11-02': { spent: 1000, updatedAt: '2026-11-02T00:00:00.000Z' } },
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const result = restoreMealNow(state, '2026-11-10');
    expect(result.error).toBeUndefined();
    expect(result.state.restores.find((event) => event.date === '2026-11-10')?.openingBalance).toBe(1000);
  });
});

describe('manual restore', () => {
  it('adds a restore for today and rejects a second one', () => {
    const state: MealStateV2 = {
      settings,
      records: {},
      restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
    };
    const first = restoreMealNow(state, '2026-11-10');
    expect(first.error).toBeUndefined();
    expect(first.state.restores.some((event) => event.date === '2026-11-10')).toBe(true);
    const second = restoreMealNow(first.state, '2026-11-10');
    expect(second.error).toBe('今天已经恢复过');
    expect(second.state.restores.filter((event) => event.date === '2026-11-10')).toHaveLength(1);
  });
});
