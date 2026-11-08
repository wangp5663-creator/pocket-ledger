import { isValidMonthKey } from '../domain/dates';
import { emptyPlanState } from '../domain/planItems';
import type { PlanState } from '../domain/planItems';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const PLAN_ITEMS_STORAGE_KEY = 'planned-ledger.plan-items.v1';

export function isPlanState(value: unknown): value is PlanState {
  if (!isPlainObject(value) || !Array.isArray(value.items)) return false;
  return value.items.every(
    (item) =>
      isPlainObject(item) &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      item.title.trim().length > 0 &&
      typeof item.createdAt === 'string' &&
      typeof item.spendMonth === 'string' &&
      isValidMonthKey(item.spendMonth) &&
      typeof item.replenishMonth === 'string' &&
      isValidMonthKey(item.replenishMonth) &&
      typeof item.amount === 'number' &&
      Number.isInteger(item.amount) &&
      item.amount > 0,
  );
}

export function loadPlanState(): LoadResult<PlanState> {
  return loadJson(PLAN_ITEMS_STORAGE_KEY, isPlanState, emptyPlanState);
}

export function savePlanState(state: PlanState): string | null {
  return saveJson(PLAN_ITEMS_STORAGE_KEY, state);
}
