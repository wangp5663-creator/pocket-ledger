import { defaultMealState } from '../domain/meal';
import type { MealState } from '../domain/meal';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const MEAL_STORAGE_KEY = 'meal-allowance.v1';

export function isMealState(value: unknown): value is MealState {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.settings)) return false;
  const { dailyAllowance, startDate } = value.settings;
  if (typeof dailyAllowance !== 'number' || typeof startDate !== 'string') return false;
  if (!isPlainObject(value.records)) return false;
  return Object.values(value.records).every((record) => {
    if (!isPlainObject(record)) return false;
    return (
      typeof record.spent === 'number' &&
      typeof record.allowance === 'number' &&
      typeof record.updatedAt === 'string' &&
      (record.note === undefined || typeof record.note === 'string')
    );
  });
}

export function loadMealState(): LoadResult<MealState> {
  return loadJson(MEAL_STORAGE_KEY, isMealState, defaultMealState);
}

export function saveMealState(state: MealState): string | null {
  return saveJson(MEAL_STORAGE_KEY, state);
}
