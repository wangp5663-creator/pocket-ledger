import { describe, expect, it } from 'vitest';
import {
  completedEventGroups,
  computePlanningBalance,
  emptyPlanningState,
  eventProgress,
  eventTimeline,
  firstSpendMonth,
  isEventCompleted,
  partitionEvents,
  partitionInflows,
  planningMonthSummary,
  removeEvent,
  replenishPlanComparison,
  type PlanningState,
} from './planning';

const createdAt = '2026-11-01T00:00:00.000Z';

const state: PlanningState = {
  events: [
    {
      id: 'e1',
      name: '买电脑',
      plannedTotal: 500000,
      replenishPlan: [
        { month: '2026-12', amount: 300000 },
        { month: '2027-01', amount: 200000 },
      ],
      createdAt,
    },
    { id: 'e2', name: '旅行', replenishPlan: [], createdAt },
  ],
  spends: [
    { id: 's1', eventId: 'e1', date: '2026-11-02', amount: 300000, createdAt },
    { id: 's2', eventId: 'e1', date: '2026-11-03', amount: 250000, createdAt },
    { id: 's3', eventId: 'e2', date: '2026-11-04', amount: 100000, createdAt },
  ],
  replenishes: [
    { id: 'r1', eventId: 'e1', date: '2026-12-05', amount: 150000, createdAt },
    { id: 'r2', eventId: 'e1', date: '2027-01-05', amount: 50000, createdAt },
  ],
  inflows: [{ id: 'i1', date: '2026-11-10', amount: 200000, createdAt }],
};

describe('planning balance', () => {
  it('adds inflows and replenishes, subtracts spends', () => {
    expect(computePlanningBalance(state)).toBe(200000 + 200000 - 650000);
    expect(computePlanningBalance(emptyPlanningState())).toBe(0);
  });
});

describe('event progress', () => {
  it('aggregates multiple spends and replenishes', () => {
    const progress = eventProgress(state, 'e1');
    expect(progress.spent).toBe(550000);
    expect(progress.replenished).toBe(200000);
    expect(progress.outstanding).toBe(350000);
    expect(progress.overPlanned).toBe(50000);
  });

  it('reports negative outstanding when over replenished', () => {
    const over: PlanningState = {
      ...state,
      replenishes: [{ id: 'r3', eventId: 'e2', date: '2026-11-20', amount: 150000, createdAt }],
    };
    expect(eventProgress(over, 'e2').outstanding).toBe(-50000);
  });
});

describe('event timeline', () => {
  it('merges spends and replenishes with running outstanding', () => {
    const timeline = eventTimeline(state, 'e1');
    expect(timeline.map((item) => [item.kind, item.amount, item.outstandingAfter])).toEqual([
      ['spend', 300000, 300000],
      ['spend', 250000, 550000],
      ['replenish', 150000, 400000],
      ['replenish', 50000, 350000],
    ]);
  });
});

describe('replenish plan comparison', () => {
  it('compares planned and actual per month', () => {
    const comparison = replenishPlanComparison(state, 'e1');
    expect(comparison).toEqual([
      { month: '2026-12', planned: 300000, actual: 150000, diff: -150000 },
      { month: '2027-01', planned: 200000, actual: 50000, diff: -150000 },
    ]);
  });
});

describe('planning month summary', () => {
  it('aggregates monthly entries and end balance', () => {
    const summary = planningMonthSummary(state, '2026-11', '2026-12-15');
    expect(summary.spends).toBe(650000);
    expect(summary.replenishes).toBe(0);
    expect(summary.inflows).toBe(200000);
    expect(summary.net).toBe(-450000);
    expect(summary.endBalance).toBe(-450000);
  });
});

describe('remove event', () => {
  it('cascades spends and replenishes but keeps inflows', () => {
    const next = removeEvent(state, 'e1');
    expect(next.events.map((event) => event.id)).toEqual(['e2']);
    expect(next.spends.map((entry) => entry.id)).toEqual(['s3']);
    expect(next.replenishes).toEqual([]);
    expect(next.inflows).toHaveLength(1);
  });
});

describe('event timeline ordering', () => {
  it('orders same-date entries by createdAt', () => {
    const sameDate: PlanningState = {
      events: [{ id: 'e3', name: '同日', replenishPlan: [], createdAt }],
      spends: [
        { id: 's4', eventId: 'e3', date: '2026-11-05', amount: 100000, createdAt: '2026-11-05T10:00:00.000Z' },
      ],
      replenishes: [
        { id: 'r4', eventId: 'e3', date: '2026-11-05', amount: 40000, createdAt: '2026-11-05T09:00:00.000Z' },
      ],
      inflows: [],
    };
    const timeline = eventTimeline(sameDate, 'e3');
    expect(timeline.map((item) => item.kind)).toEqual(['replenish', 'spend']);
    expect(timeline.map((item) => item.outstandingAfter)).toEqual([-40000, 60000]);
  });
});

describe('missing event', () => {
  it('returns empty timeline and comparison and leaves state unchanged on removal', () => {
    expect(eventTimeline(state, 'missing')).toEqual([]);
    expect(replenishPlanComparison(state, 'missing')).toEqual([]);
    expect(removeEvent(state, 'missing')).toEqual(state);
    expect(eventProgress(state, 'missing')).toEqual({ spent: 0, replenished: 0, outstanding: 0, overPlanned: undefined });
  });
});

describe('plan edge cases', () => {
  it('sums duplicate plan months and treats zero planned total as a real plan', () => {
    const edge: PlanningState = {
      events: [
        {
          id: 'e4',
          name: '边界',
          plannedTotal: 0,
          replenishPlan: [
            { month: '2026-12', amount: 1000 },
            { month: '2026-12', amount: 2000 },
          ],
          createdAt,
        },
      ],
      spends: [{ id: 's5', eventId: 'e4', date: '2026-11-01', amount: 100, createdAt }],
      replenishes: [],
      inflows: [],
    };
    expect(replenishPlanComparison(edge, 'e4')).toEqual([
      { month: '2026-12', planned: 3000, actual: 0, diff: -3000 },
    ]);
    expect(eventProgress(edge, 'e4').overPlanned).toBe(100);
  });
});

describe('event partitions', () => {
  const orderState: PlanningState = {
    events: [
      { id: 'sep', name: '九月事项', replenishPlan: [], createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'nov', name: '十一月事项', replenishPlan: [], createdAt: '2026-11-01T00:00:00.000Z' },
      { id: 'idle', name: '未支出事项', replenishPlan: [], createdAt: '2026-10-01T00:00:00.000Z' },
    ],
    spends: [
      { id: 'sa', eventId: 'sep', date: '2026-09-05', amount: 100, createdAt },
      { id: 'sb', eventId: 'nov', date: '2026-11-05', amount: 100, createdAt },
    ],
    replenishes: [],
    inflows: [],
  };

  it('finds the first spend month', () => {
    expect(firstSpendMonth(state, 'e1')).toBe('2026-11');
    expect(firstSpendMonth(state, 'missing')).toBeUndefined();
  });

  it('completes only after spending and replenishing', () => {
    expect(isEventCompleted(state, 'e1')).toBe(false);
    expect(isEventCompleted(state, 'e2')).toBe(false);
  });

  it('sorts ongoing by spend month descending, then unspent last', () => {
    expect(partitionEvents(orderState).ongoing.map((event) => event.id)).toEqual(['nov', 'sep', 'idle']);
  });

  it('groups completed events by first spend month', () => {
    const completedState: PlanningState = {
      events: [
        { id: 'c1', name: '九月补完', replenishPlan: [], createdAt: '2026-09-01T00:00:00.000Z' },
        { id: 'c2', name: '十月多补', replenishPlan: [], createdAt: '2026-10-01T00:00:00.000Z' },
      ],
      spends: [
        { id: 'cs1', eventId: 'c1', date: '2026-09-03', amount: 100000, createdAt },
        { id: 'cs2', eventId: 'c2', date: '2026-10-03', amount: 50000, createdAt },
      ],
      replenishes: [
        { id: 'cr1', eventId: 'c1', date: '2026-11-05', amount: 100000, createdAt },
        { id: 'cr2', eventId: 'c2', date: '2026-11-06', amount: 60000, createdAt },
      ],
      inflows: [],
    };
    expect(isEventCompleted(completedState, 'c1')).toBe(true);
    expect(isEventCompleted(completedState, 'c2')).toBe(true);
    const groups = completedEventGroups(completedState);
    expect(groups.map((group) => group.month)).toEqual(['2026-10', '2026-09']);
    expect(groups[0]).toMatchObject({ spends: 50000, replenishes: 60000 });
    expect(groups[0].events.map((event) => event.id)).toEqual(['c2']);
  });
});

describe('inflow partitions', () => {
  it('keeps the current natural month separate from archived inflows', () => {
    const inflowState: PlanningState = {
      events: [],
      spends: [],
      replenishes: [],
      inflows: [
        { id: 'i1', date: '2026-11-02', amount: 100, createdAt },
        { id: 'i2', date: '2026-10-15', amount: 200, createdAt },
        { id: 'i3', date: '2026-12-01', amount: 300, createdAt },
      ],
    };
    const result = partitionInflows(inflowState, '2026-11-08');
    expect(result.currentMonth.map((entry) => entry.id)).toEqual(['i1']);
    expect(result.archived.map((entry) => entry.id)).toEqual(['i3', 'i2']);
  });
});
