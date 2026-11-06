import { emptyPlanningState } from '../domain/planning';
import type { PlanningState } from '../domain/planning';
import { isPlainObject, loadJson, saveJson } from './jsonStorage';
import type { LoadResult } from './jsonStorage';

export const PLANNING_STORAGE_KEY = 'planned-ledger.v1';

function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isEntryBase(entry: unknown): boolean {
  if (!isPlainObject(entry)) return false;
  return (
    typeof entry.id === 'string' &&
    typeof entry.date === 'string' &&
    isCents(entry.amount) &&
    typeof entry.createdAt === 'string' &&
    (entry.note === undefined || typeof entry.note === 'string')
  );
}

function isEventLinkedEntry(entry: unknown): boolean {
  return isEntryBase(entry) && isPlainObject(entry) && typeof entry.eventId === 'string';
}

export function isPlanningState(value: unknown): value is PlanningState {
  if (!isPlainObject(value)) return false;
  const { events, spends, replenishes, inflows } = value;
  if (!Array.isArray(events) || !Array.isArray(spends) || !Array.isArray(replenishes) || !Array.isArray(inflows)) {
    return false;
  }
  const eventsOk = events.every(
    (event) =>
      isPlainObject(event) &&
      typeof event.id === 'string' &&
      typeof event.name === 'string' &&
      typeof event.createdAt === 'string' &&
      (event.plannedTotal === undefined || isCents(event.plannedTotal)) &&
      (event.note === undefined || typeof event.note === 'string') &&
      Array.isArray(event.replenishPlan) &&
      event.replenishPlan.every(
        (item) => isPlainObject(item) && typeof item.month === 'string' && isCents(item.amount),
      ),
  );
  return (
    eventsOk &&
    spends.every(isEventLinkedEntry) &&
    replenishes.every(isEventLinkedEntry) &&
    inflows.every(isEntryBase)
  );
}

export function loadPlanningState(): LoadResult<PlanningState> {
  return loadJson(PLANNING_STORAGE_KEY, isPlanningState, emptyPlanningState);
}

export function savePlanningState(state: PlanningState): string | null {
  return saveJson(PLANNING_STORAGE_KEY, state);
}
