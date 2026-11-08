import { addMonths, isValidMonthKey } from './dates';

export interface PlanItem {
  id: string;
  spendMonth: string;
  title: string;
  amount: number;
  replenishMonth: string;
  createdAt: string;
}

export interface PlanState {
  items: PlanItem[];
}

export interface PlanItemDraft {
  spendMonth: string;
  title: string;
  amount: number;
  replenishMonth: string;
}

export function emptyPlanState(): PlanState {
  return { items: [] };
}

export function validatePlanItemDraft(draft: PlanItemDraft): string | null {
  if (!draft.title.trim()) return '请填写事件内容';
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) return '请输入大于 0 的金额';
  if (!isValidMonthKey(draft.spendMonth) || !isValidMonthKey(draft.replenishMonth)) {
    return '请选择有效的月份';
  }
  return null;
}

export interface PlanMonthBucket {
  month: string;
  spend: number;
  replenish: number;
  net: number;
  cumulative: number;
}

export function planMonthBuckets(items: PlanItem[], startMonth: string, length: number): PlanMonthBucket[] {
  const buckets: PlanMonthBucket[] = [];
  let cumulative = 0;
  for (let index = 0; index < length; index += 1) {
    const month = addMonths(startMonth, index);
    const spend = items
      .filter((item) => item.spendMonth === month)
      .reduce((total, item) => total + item.amount, 0);
    const replenish = items
      .filter((item) => item.replenishMonth === month)
      .reduce((total, item) => total + item.amount, 0);
    const net = replenish - spend;
    cumulative += net;
    buckets.push({ month, spend, replenish, net, cumulative });
  }
  return buckets;
}

export function summarizePlanRange(
  items: PlanItem[],
  startMonth: string,
  length: number,
): { spend: number; replenish: number; net: number; cumulative: number } {
  const buckets = planMonthBuckets(items, startMonth, length);
  const spend = buckets.reduce((total, bucket) => total + bucket.spend, 0);
  const replenish = buckets.reduce((total, bucket) => total + bucket.replenish, 0);
  return {
    spend,
    replenish,
    net: replenish - spend,
    cumulative: buckets[buckets.length - 1]?.cumulative ?? 0,
  };
}

export function sortPlanItems(items: PlanItem[], mode: 'spendMonth' | 'createdAt'): PlanItem[] {
  return [...items].sort((a, b) => {
    if (mode === 'spendMonth' && a.spendMonth !== b.spendMonth) {
      return a.spendMonth.localeCompare(b.spendMonth);
    }
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    return byCreated !== 0 ? byCreated : a.id.localeCompare(b.id);
  });
}
