import { describe, expect, it } from 'vitest';
import { PLANNING_STORAGE_KEY, isPlanningState, loadPlanningState, savePlanningState } from './planningStorage';
import { emptyPlanningState } from '../domain/planning';

const state = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [{ month: '2026-12', amount: 300000 }],
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 500000, createdAt: '2026-11-02T00:00:00.000Z' },
  ],
  replenishes: [],
  inflows: [{ id: 'i1', date: '2026-11-03', amount: 100000, note: '红包', createdAt: '2026-11-03T00:00:00.000Z' }],
};

describe('planningStorage', () => {
  it('round-trips planning state', () => {
    expect(savePlanningState(state)).toBeNull();
    expect(loadPlanningState()).toEqual({ value: state });
    expect(localStorage.getItem(PLANNING_STORAGE_KEY)).toContain('买电脑');
  });

  it('rejects invalid shapes', () => {
    expect(isPlanningState({ events: [], spends: [], replenishes: [] })).toBe(false);
    expect(
      isPlanningState({
        events: [{ id: 'e1', name: 'x', replenishPlan: [{ month: '2026-12', amount: 'bad' }], createdAt: 'now' }],
        spends: [],
        replenishes: [],
        inflows: [],
      }),
    ).toBe(false);
  });

  it('falls back to defaults when storage is empty', () => {
    expect(loadPlanningState()).toEqual({ value: emptyPlanningState() });
  });
});
