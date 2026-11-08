import { describe, expect, it } from 'vitest';
import { emptyPlanState } from '../domain/planItems';
import {
  PLAN_ITEMS_STORAGE_KEY,
  isPlanState,
  loadPlanState,
  savePlanState,
} from './planItemsStorage';

const state = {
  items: [
    {
      id: 'p1',
      spendMonth: '2026-11',
      title: '换电脑',
      amount: 500000,
      replenishMonth: '2026-12',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
};

describe('planItemsStorage', () => {
  it('round-trips plan state', () => {
    expect(savePlanState(state)).toBeNull();
    expect(loadPlanState()).toEqual({ value: state });
    expect(localStorage.getItem(PLAN_ITEMS_STORAGE_KEY)).toContain('换电脑');
  });

  it('rejects invalid shapes', () => {
    expect(isPlanState({ items: 'bad' })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], amount: 0 }] })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], spendMonth: '2026-13' }] })).toBe(false);
    expect(isPlanState({ items: [{ ...state.items[0], title: '  ' }] })).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadPlanState()).toEqual({ value: emptyPlanState() });
  });
});
