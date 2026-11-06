import { describe, expect, it } from 'vitest';
import { migrateMealV1ToV2 } from './mealMigration';
import type { MealState } from '../domain/meal';

const v1: MealState = {
  settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
  records: {
    '2026-11-02': {
      spent: 1500,
      note: '午饭',
      allowance: 2000,
      updatedAt: '2026-11-02T00:00:00.000Z',
    },
  },
};

describe('migrateMealV1ToV2', () => {
  it('maps daily allowance to monthly budget and minimum', () => {
    const state = migrateMealV1ToV2(v1);
    expect(state.settings).toEqual({
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      startDate: '2026-11-01',
    });
    expect(state.records['2026-11-02']).toEqual({
      spent: 1500,
      note: '午饭',
      updatedAt: '2026-11-02T00:00:00.000Z',
    });
    expect(state.records['2026-11-02']).not.toHaveProperty('allowance');
  });

  it('creates the first restore event', () => {
    const state = migrateMealV1ToV2(v1);
    expect(state.restores).toHaveLength(1);
    expect(state.restores[0]).toMatchObject({
      date: '2026-11-01',
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      freeAllowance: 15000,
      dailyNormal: 2000,
      dailyMinimum: 1500,
    });
  });

  it('keeps onboarding state without a start date', () => {
    const state = migrateMealV1ToV2({
      settings: { dailyAllowance: 2000, startDate: '' },
      records: {},
    });
    expect(state.settings.startDate).toBe('');
    expect(state.restores).toEqual([]);
  });

  it('keeps a positive free allowance for small old allowances', () => {
    const state = migrateMealV1ToV2({
      settings: { dailyAllowance: 1000, startDate: '2026-11-01' },
      records: {},
    });
    expect(state.settings.monthlyBudget).toBe(30000);
    expect(state.settings.monthlyMinimum).toBe(28500);
  });

  it('falls back to the default allowance for zero or negative legacy values', () => {
    const state = migrateMealV1ToV2({
      settings: { dailyAllowance: 0, startDate: '2026-11-01' },
      records: {},
    });
    expect(state.settings.monthlyBudget).toBe(60000);
    expect(state.settings.monthlyMinimum).toBe(45000);
  });
});
