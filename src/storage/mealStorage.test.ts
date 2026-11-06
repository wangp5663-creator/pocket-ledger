import { describe, expect, it } from 'vitest';
import { MEAL_STORAGE_KEY, isMealState, loadMealState, saveMealState } from './mealStorage';
import { defaultMealState } from '../domain/meal';

describe('mealStorage', () => {
  it('round-trips meal state', () => {
    const state = {
      settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
      records: { '2026-11-01': { spent: 1500, note: '午饭', allowance: 2000, updatedAt: '2026-11-01T00:00:00.000Z' } },
    };
    expect(saveMealState(state)).toBeNull();
    expect(loadMealState()).toEqual({ value: state });
    expect(localStorage.getItem(MEAL_STORAGE_KEY)).toContain('2026-11-01');
  });

  it('rejects invalid shapes', () => {
    expect(isMealState({ settings: { dailyAllowance: 2000 }, records: {} })).toBe(false);
    expect(isMealState({ settings: { dailyAllowance: 2000, startDate: '2026-11-01' }, records: { x: { spent: 1 } } })).toBe(false);
    expect(
      isMealState({ settings: { dailyAllowance: 2000.5, startDate: '2026-11-01' }, records: {} }),
    ).toBe(false);
    expect(
      isMealState({
        settings: { dailyAllowance: 2000, startDate: '2026-11-01' },
        records: { '2026-11-01': { spent: 1.5, allowance: 2000, updatedAt: 'x' } },
      }),
    ).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadMealState()).toEqual({ value: defaultMealState() });
  });
});
