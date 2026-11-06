import { defaultMealStateV2 } from '../domain/mealV2';
import type { MealStateV2 } from '../domain/mealV2';
import { loadMealState } from './mealStorage';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';
import { migrateMealV1ToV2 } from './mealMigration';

export const MEAL_V2_STORAGE_KEY = 'meal-allowance.v2';

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRestoreEvent(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    typeof value.at === 'string' &&
    isCents(value.openingBalance) &&
    isCents(value.monthlyBudget) &&
    isCents(value.monthlyMinimum) &&
    isCents(value.freeAllowance) &&
    isCents(value.dailyNormal) &&
    isCents(value.dailyMinimum) &&
    (value.note === undefined || typeof value.note === 'string')
  );
}

export function isMealStateV2(value: unknown): value is MealStateV2 {
  if (!isPlainObject(value)) return false;
  if (!isPlainObject(value.settings)) return false;
  const { monthlyBudget, monthlyMinimum, startDate } = value.settings;
  if (!isCents(monthlyBudget) || !isCents(monthlyMinimum) || typeof startDate !== 'string') return false;
  if (monthlyBudget <= monthlyMinimum) return false;
  if (!isPlainObject(value.records)) return false;
  const recordsOk = Object.values(value.records).every(
    (record) =>
      isPlainObject(record) &&
      isCents(record.spent) &&
      typeof record.updatedAt === 'string' &&
      (record.note === undefined || typeof record.note === 'string'),
  );
  return recordsOk && Array.isArray(value.restores) && value.restores.every(isRestoreEvent);
}

export interface MealLoadResult extends LoadResult<MealStateV2> {
  migrated?: boolean;
}

export function loadMealStateV2(): MealLoadResult {
  const v2 = loadJson(MEAL_V2_STORAGE_KEY, isMealStateV2, defaultMealStateV2);
  if (!v2.error && localStorage.getItem(MEAL_V2_STORAGE_KEY)) return v2;

  const v1 = loadMealState();
  if (v1.error === undefined && localStorage.getItem('meal-allowance.v1')) {
    const migrated = migrateMealV1ToV2(v1.value);
    saveJson(MEAL_V2_STORAGE_KEY, migrated);
    return { value: migrated, migrated: true };
  }

  return v2;
}

export function saveMealStateV2(state: MealStateV2): string | null {
  return saveJson(MEAL_V2_STORAGE_KEY, state);
}
