import { describe, expect, it } from 'vitest';
import {
  planMonthBuckets,
  sortPlanItems,
  summarizePlanRange,
  validatePlanItemDraft,
  type PlanItem,
} from './planItems';

const items: PlanItem[] = [
  {
    id: 'a',
    spendMonth: '2026-11',
    title: '换电脑',
    amount: 500000,
    replenishMonth: '2026-12',
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'b',
    spendMonth: '2026-12',
    title: '旅行',
    amount: 200000,
    replenishMonth: '2027-01',
    createdAt: '2026-11-02T00:00:00.000Z',
  },
  {
    id: 'c',
    spendMonth: '2026-09',
    title: '旧账',
    amount: 100000,
    replenishMonth: '2026-11',
    createdAt: '2026-11-03T00:00:00.000Z',
  },
];

describe('plan month buckets', () => {
  it('aggregates spend, replenish, net and cumulative', () => {
    expect(planMonthBuckets(items, '2026-11', 3)).toEqual([
      { month: '2026-11', spend: 500000, replenish: 100000, net: -400000, cumulative: -400000 },
      { month: '2026-12', spend: 200000, replenish: 500000, net: 300000, cumulative: -100000 },
      { month: '2027-01', spend: 0, replenish: 200000, net: 200000, cumulative: 100000 },
    ]);
  });

  it('summarizes the selected range', () => {
    expect(summarizePlanRange(items, '2026-11', 3)).toEqual({
      spend: 700000,
      replenish: 800000,
      net: 100000,
      cumulative: 100000,
    });
  });
});

describe('plan sorting', () => {
  it('sorts by spend month then creation time', () => {
    expect(sortPlanItems(items, 'spendMonth').map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by creation time', () => {
    expect(sortPlanItems(items, 'createdAt').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('plan draft validation', () => {
  it('requires a title, a positive amount and valid months', () => {
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: '', amount: 100, replenishMonth: '2026-12' }),
    ).toBe('请填写事件内容');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: 'x', amount: 0, replenishMonth: '2026-12' }),
    ).toBe('请输入大于 0 的金额');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-13', title: 'x', amount: 100, replenishMonth: '2026-12' }),
    ).toBe('请选择有效的月份');
    expect(
      validatePlanItemDraft({ spendMonth: '2026-11', title: 'x', amount: 100, replenishMonth: '2026-12' }),
    ).toBeNull();
  });
});
