import { describe, expect, it } from 'vitest';
import {
  createRestoreEvent,
  defaultMealStateV2,
  deriveRates,
  missingMealDates,
  removeMealRecord,
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
