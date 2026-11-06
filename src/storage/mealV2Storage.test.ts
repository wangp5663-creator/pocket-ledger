import { describe, expect, it } from 'vitest';
import { MEAL_V2_STORAGE_KEY, isMealStateV2, loadMealStateV2, saveMealStateV2 } from './mealV2Storage';
import { createRestoreEvent, type MealStateV2 } from '../domain/mealV2';

const settings = { monthlyBudget: 60000, monthlyMinimum: 45000, startDate: '2026-11-01' };
const state: MealStateV2 = {
  settings,
  records: {
    '2026-11-02': { spent: 1500, updatedAt: '2026-11-02T00:00:00.000Z' },
  },
  restores: [createRestoreEvent(settings, '2026-11-01', '2026-11-01T00:00:00.000Z')],
};

describe('mealV2Storage', () => {
  it('round-trips v2 state', () => {
    expect(saveMealStateV2(state)).toBeNull();
    expect(loadMealStateV2()).toEqual({ value: state });
    expect(localStorage.getItem(MEAL_V2_STORAGE_KEY)).toContain('2026-11-02');
  });

  it('rejects invalid v2 shapes', () => {
    expect(isMealStateV2({ settings })).toBe(false);
    expect(isMealStateV2({ ...state, restores: [{ date: '2026-11-01' }] })).toBe(false);
  });

  it('migrates v1 data automatically', () => {
    localStorage.setItem(
      'meal-allowance.v1',
      JSON.stringify({
        settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
        records: {
          '2026-11-02': { spent: 1500, allowance: 2000, updatedAt: '2026-11-02T00:00:00.000Z' },
        },
      }),
    );
    const result = loadMealStateV2();
    expect(result.migrated).toBe(true);
    expect(result.value.settings.monthlyBudget).toBe(60000);
    expect(result.value.restores).toHaveLength(1);
    expect(localStorage.getItem(MEAL_V2_STORAGE_KEY)).toContain('60000');
  });

  it('falls back to defaults when both stores are empty', () => {
    expect(loadMealStateV2().value.settings).toEqual({
      monthlyBudget: 60000,
      monthlyMinimum: 45000,
      startDate: '',
    });
  });
});
